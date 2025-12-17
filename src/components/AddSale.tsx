import React, { useEffect, useState } from 'react';
import {
    addFoodOrder,
    getActiveGuests,
    getMenuItems,
    printOrderReceipt,
    toggleFoodOrderPayment,
    type ActiveGuestRow,
    type MenuItem,
    type NewFoodOrder,
    type OrderItem
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface AddSaleProps {
  onBack: () => void;
  onSaleAdded: () => void;
}

interface OrderItemWithDetails extends OrderItem {
  menu_item: MenuItem;
  total_price: number;
}

const AddSale: React.FC<AddSaleProps> = ({ onBack, onSaleAdded }) => {
  const { colors, theme } = useTheme();
  const { showSuccess, showError, showWarning } = useNotification();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  const [customerType, setCustomerType] = useState<'active' | 'walkin'>('active');
  const [selectedGuestId, setSelectedGuestId] = useState<number>(0);
  const [walkinCustomerName, setWalkinCustomerName] = useState('Walk-in');
  const [activeGuests, setActiveGuests] = useState<ActiveGuestRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithDetails[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [guests, menu] = await Promise.all([
          getActiveGuests(),
          getMenuItems()
        ]);
        setActiveGuests(guests);
        const availableMenu = menu.filter(item => item.is_available);
        setMenuItems(availableMenu);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Failed to load data:', err);
        const errorMessage = 'Failed to load guests and menu items';
        setError(errorMessage);
        showError('Loading Error', errorMessage);
      }
    };

    loadData();
  }, [showError]);

  const handleAddItem = () => {
    if (selectedMenuItemId === 0 || quantity <= 0) {
      const errorMessage = 'Please select a menu item and enter valid quantity';
      setError(errorMessage);
      showWarning('Invalid Selection', errorMessage);
      return;
    }

    const menuItem = menuItems.find(item => item.id === selectedMenuItemId);
    if (!menuItem) {
      const errorMessage = 'Selected menu item not found';
      setError(errorMessage);
      showError('Item Not Found', errorMessage);
      return;
    }

    // Check if item already exists in order
    const existingItemIndex = orderItems.findIndex(
      item => item.menu_item_id === selectedMenuItemId
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total_price = 
        updatedItems[existingItemIndex].quantity * menuItem.price;
      setOrderItems(updatedItems);
      showSuccess('Item Updated', `${menuItem.name} quantity updated to ${updatedItems[existingItemIndex].quantity}`);
    } else {
      // Add new item
      const newOrderItem: OrderItemWithDetails = {
          menu_item_id: selectedMenuItemId,
          quantity: quantity,
          unit_price: menuItem.price,
          menu_item: menuItem,
          total_price: quantity * menuItem.price,
          item_name: ''
      };
      setOrderItems([...orderItems, newOrderItem]);
      showSuccess('Item Added', `${quantity}x ${menuItem.name} added to order`);
    }

    // Reset selection
    setSelectedMenuItemId(0);
    setQuantity(1);
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
  };

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate
      if (customerType === 'active' && selectedGuestId === 0) {
        throw new Error('Please select an active guest');
      }
      if (orderItems.length === 0) {
        throw new Error('Please add at least one item to the order');
      }

      // For walk-in customers, we'll use null instead of 0
      let guestId: number | null = selectedGuestId;
      
      if (customerType === 'walkin') {
        // For walk-in customers, use null to indicate no specific guest
        guestId = null;
      }

      const newOrder: NewFoodOrder = {
        guest_id: guestId,
        items: orderItems.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.menu_item.name,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      const orderId = await addFoodOrder(newOrder);
      console.log('✅ Food order added successfully:', orderId);
      
      const customerInfo = customerType === 'walkin' 
        ? walkinCustomerName 
        : activeGuests.find(g => g.guest_id === selectedGuestId)?.name || 'Guest';
      
      showSuccess(
        'Food Order Created!',
        `Order #${orderId} has been created for ${customerInfo} (Total: ${formatMoney(getTotalAmount())})`
      );
      
      setLastOrderId(orderId);
      setShowSuccessModal(true);
      
      // Reset form
      setOrderItems([]);
      setSelectedGuestId(0);
      setWalkinCustomerName('Walk-in');
      setSelectedMenuItemId(0);
      setQuantity(1);
      setCustomerType('active');

      onSaleAdded();
    } catch (err) {
      console.error('❌ Failed to add food order:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add food order';
      setError(errorMessage);
      showError('Failed to Create Order', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!lastOrderId) return;
    
    try {
      const receiptHtml = await printOrderReceipt(lastOrderId);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        showSuccess('Receipt Printed', `Receipt for order #${lastOrderId} has been sent to printer`);
      } else {
        showWarning('Print Window Blocked', 'Please allow popups to print receipts');
      }
    } catch (err) {
      console.error('Failed to print receipt:', err);
      const errorMessage = 'Failed to generate receipt';
      setError(errorMessage);
      showError('Print Failed', errorMessage);
    }
  };

  const handleTogglePayment = async () => {
    if (!lastOrderId) return;
    
    try {
      const result = await toggleFoodOrderPayment(lastOrderId);
      console.log('Payment status toggled:', result);
      
      // Update the local payment status
      const newStatus = paymentStatus === 'paid' ? 'unpaid' : 'paid';
      setPaymentStatus(newStatus);
      
      showSuccess(
        'Payment Status Updated', 
        `Order #${lastOrderId} marked as ${newStatus.toUpperCase()}`
      );
      
      // Show success message
      setError(null);
    } catch (err) {
      console.error('Failed to toggle payment:', err);
      const errorMessage = 'Failed to update payment status';
      setError(errorMessage);
      showError('Payment Update Failed', errorMessage);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setLastOrderId(null);
    setPaymentStatus('unpaid'); // Reset payment status for next order
  };

  return (
    <div style={{
      padding: '2rem',
      backgroundColor: colors.primary,
      color: colors.text,
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '1rem'
      }}>
        <button
          onClick={onBack}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.accent,
            fontSize: '1.5rem',
            cursor: 'pointer',
            marginRight: '1rem',
            padding: '0.5rem'
          }}
        >
          ←
        </button>
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 'bold',
          margin: 0,
          background: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Add Food Order
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        {/* Select Customer Type */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Select Customer type
          </label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="customerType"
                value="active"
                checked={customerType === 'active'}
                onChange={(e) => setCustomerType(e.target.value as 'active' | 'walkin')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ color: colors.text }}>Active {label.client}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="customerType"
                value="walkin"
                checked={customerType === 'walkin'}
                onChange={(e) => setCustomerType(e.target.value as 'active' | 'walkin')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ color: colors.text }}>Walk-in {label.client.toLowerCase()}</span>
            </label>
          </div>

          {/* Customer Selection */}
          {customerType === 'active' ? (
            <select
              value={selectedGuestId}
              onChange={(e) => setSelectedGuestId(parseInt(e.target.value))}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              <option value={0}>Select an active {label.client.toLowerCase()}</option>
              {activeGuests.map(guest => (
                <option key={guest.guest_id} value={guest.guest_id}>
                  {guest.name} - {label.unit} {guest.room_number}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={walkinCustomerName}
              onChange={(e) => setWalkinCustomerName(e.target.value)}
              placeholder={`${label.client} name (optional)`}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '1rem'
              }}
            />
          )}
        </div>

        {/* Date */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Date
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '1rem',
                colorScheme: theme === 'dark' ? 'dark' : 'light'
              }}
            />
            <style dangerouslySetInnerHTML={{
              __html: `
                input[type="datetime-local"]::-webkit-calendar-picker-indicator {
                  filter: ${theme === 'light' ? 'invert(0)' : 'invert(1)'};
                  cursor: pointer;
                }
                input[type="datetime-local"]::-webkit-datetime-edit {
                  color: ${colors.text};
                }
              `
            }} />
          </div>
        </div>

        {/* Add Menu Items */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Food Item
          </label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select
              value={selectedMenuItemId}
              onChange={(e) => setSelectedMenuItemId(parseInt(e.target.value))}
              style={{
                flex: '2',
                minWidth: '200px',
                padding: '0.75rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              <option value={0}>Select food item</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatMoney(item.price)}
                </option>
              ))}
            </select>
            
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              placeholder="Qty"
              style={{
                flex: '1',
                minWidth: '80px',
                padding: '0.75rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '1rem'
              }}
            />
            
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: colors.success,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              Add Item
            </button>
          </div>

          {/* Selected Items Display */}
          {orderItems.length > 0 && (
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '8px',
              padding: '1rem',
              border: `1px solid ${colors.border}`
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: colors.accent }}>Order Items:</h3>
              {orderItems.map((item, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: index < orderItems.length - 1 ? `1px solid ${colors.border}` : 'none'
                }}>
                  <div>
                    <span style={{ fontWeight: '500' }}>{item.menu_item.name}</span>
                    <span style={{ color: colors.textMuted, marginLeft: '0.5rem' }}>
                      x{item.quantity} @ {formatMoney(item.unit_price)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: '600' }}>{formatMoney(item.total_price)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      style={{
                        backgroundColor: colors.error,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem',
                padding: '0.5rem 0',
                borderTop: `2px solid ${colors.accent}`,
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                <span>Total Amount:</span>
                <span style={{ color: colors.success }}>{formatMoney(getTotalAmount())}</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: colors.error,
            color: 'white',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || orderItems.length === 0}
          style={{
            backgroundColor: loading || orderItems.length === 0 ? colors.textMuted : colors.success,
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading || orderItems.length === 0 ? 'not-allowed' : 'pointer',
            width: '100%'
          }}
        >
          {loading ? 'Adding Order...' : 'Add Order'}
        </button>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: colors.surface,
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            border: `1px solid ${colors.success}`,
            maxWidth: '400px',
            width: '90%'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              ✅
            </div>
            <h2 style={{
              color: colors.success,
              marginBottom: '1rem',
              fontSize: '1.5rem'
            }}>
              Food Order Added
            </h2>
            <p style={{
              marginBottom: '1rem',
              color: colors.textMuted
            }}>
              Payment Status: <span style={{
                color: paymentStatus === 'paid' ? colors.success : colors.warning,
                fontWeight: 'bold'
              }}>
                {paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
              </span>
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              marginTop: '1.5rem'
            }}>
              <button
                onClick={handlePrintReceipt}
                style={{
                  backgroundColor: colors.accent,
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Print Receipt
              </button>
              <button
                onClick={handleTogglePayment}
                style={{
                  backgroundColor: paymentStatus === 'paid' ? colors.error : colors.success,
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Mark as {paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
              </button>
              <button
                onClick={closeSuccessModal}
                style={{
                  backgroundColor: colors.textMuted,
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddSale;
