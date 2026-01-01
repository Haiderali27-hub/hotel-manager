import React, { useEffect, useState } from 'react';
import {
    addSale,
    getActiveCustomers,
    getMenuItems,
    printOrderReceipt,
    toggleSalePayment,
    type ActiveCustomerRow,
    type MenuItem,
    type NewSale,
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
  const [activeGuests, setActiveGuests] = useState<ActiveCustomerRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithDetails[]>([]);
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
          getActiveCustomers(),
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

  const addItemToOrder = (menuItemId: number, qty: number) => {
    if (!menuItemId || qty <= 0) {
      const errorMessage = 'Please select a product and enter valid quantity';
      setError(errorMessage);
      showWarning('Invalid Selection', errorMessage);
      return;
    }

    const menuItem = menuItems.find(item => item.id === menuItemId);
    if (!menuItem) {
      const errorMessage = 'Selected menu item not found';
      setError(errorMessage);
      showError('Item Not Found', errorMessage);
      return;
    }

    // Check if item already exists in order
    const existingItemIndex = orderItems.findIndex(
      item => item.menu_item_id === menuItemId
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += qty;
      updatedItems[existingItemIndex].total_price = 
        updatedItems[existingItemIndex].quantity * menuItem.price;
      setOrderItems(updatedItems);
      showSuccess('Item Updated', `${menuItem.name} quantity updated to ${updatedItems[existingItemIndex].quantity}`);
    } else {
      // Add new item
      const newOrderItem: OrderItemWithDetails = {
          menu_item_id: menuItemId,
          quantity: qty,
          unit_price: menuItem.price,
          menu_item: menuItem,
          total_price: qty * menuItem.price,
          item_name: ''
      };
      setOrderItems([...orderItems, newOrderItem]);
      showSuccess('Item Added', `${qty}x ${menuItem.name} added to order`);
    }
    setError(null);
  };

  const handleIncreaseQty = (index: number) => {
    const updated = [...orderItems];
    updated[index].quantity += 1;
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setOrderItems(updated);
  };

  const handleDecreaseQty = (index: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, updated[index].quantity - 1);
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setOrderItems(updated);
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
        throw new Error(`Please select an active ${label.client.toLowerCase()}`);
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

      const newOrder: NewSale = {
        guest_id: guestId,
        items: orderItems.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.menu_item.name,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      const orderId = await addSale(newOrder);
      console.log('✅ Sale added successfully:', orderId);
      
      const customerInfo = customerType === 'walkin' 
        ? walkinCustomerName 
        : activeGuests.find(g => g.guest_id === selectedGuestId)?.name || label.client;
      
      showSuccess(
        'Sale Created!',
        `Sale #${orderId} has been created for ${customerInfo} (Total: ${formatMoney(getTotalAmount())})`
      );
      
      setLastOrderId(orderId);
      setShowSuccessModal(true);
      
      // Reset form
      setOrderItems([]);
      setSelectedGuestId(0);
      setWalkinCustomerName('Walk-in');
      setCustomerType('active');

      onSaleAdded();
    } catch (err) {
      console.error('❌ Failed to add sale:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add sale';
      setError(errorMessage);
      showError('Failed to Create Sale', errorMessage);
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
      const result = await toggleSalePayment(lastOrderId);
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
    <div style={{ padding: '24px', backgroundColor: colors.primary, color: colors.text, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="bc-btn bc-btn-outline" onClick={onBack} style={{ width: 'auto' }}>
          Back
        </button>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text }}>POS / Sales</div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>Create a new sale</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {/* Left: Products grid */}
          <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: colors.text }}>Products</div>
              <div style={{ fontSize: '12px', color: colors.textSecondary }}>{menuItems.length} items</div>
            </div>

            <div
              style={{
                marginTop: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={() => addItemToOrder(item.id, 1)}
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: '10px',
                    display: 'block',
                  }}
                >
                  <div style={{ fontWeight: 800, color: colors.text, fontSize: '14px' }}>{item.name}</div>
                  <div style={{ marginTop: '4px', color: colors.textSecondary, fontSize: '12px' }}>
                    {formatMoney(item.price)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Cart */}
          <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: colors.text }}>Cart</div>

            {/* Customer */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
                Customer
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="customerType"
                    value="active"
                    checked={customerType === 'active'}
                    onChange={(e) => setCustomerType(e.target.value as 'active' | 'walkin')}
                  />
                  <span style={{ fontSize: '12px', color: colors.text }}>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="customerType"
                    value="walkin"
                    checked={customerType === 'walkin'}
                    onChange={(e) => setCustomerType(e.target.value as 'active' | 'walkin')}
                  />
                  <span style={{ fontSize: '12px', color: colors.text }}>Walk-in</span>
                </label>
              </div>

              {customerType === 'active' ? (
                <select
                  value={selectedGuestId}
                  onChange={(e) => setSelectedGuestId(parseInt(e.target.value))}
                  className="bc-input"
                  required
                >
                  <option value={0}>Select an active {label.client.toLowerCase()}</option>
                  {activeGuests.map((guest) => (
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
                  className="bc-input"
                />
              )}
            </div>

            {/* Items */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '8px' }}>
                Items
              </div>

              {orderItems.length === 0 ? (
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>No items yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: colors.text }}>
                            {item.menu_item.name}
                          </div>
                          <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                            {formatMoney(item.unit_price)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: colors.text }}>
                          {formatMoney(item.total_price)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="bc-btn bc-btn-outline"
                            onClick={() => handleDecreaseQty(index)}
                            style={{ width: 'auto', padding: '8px 10px' }}
                          >
                            -
                          </button>
                          <div style={{ minWidth: '28px', textAlign: 'center', fontWeight: 800, color: colors.text }}>
                            {item.quantity}
                          </div>
                          <button
                            type="button"
                            className="bc-btn bc-btn-outline"
                            onClick={() => handleIncreaseQty(index)}
                            style={{ width: 'auto', padding: '8px 10px' }}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => handleRemoveItem(index)}
                          style={{ width: 'auto' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{ marginTop: '14px', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: 700 }}>Total</div>
                <div style={{ fontSize: '16px', color: colors.text, fontWeight: 900 }}>{formatMoney(getTotalAmount())}</div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: colors.text,
                  fontSize: '12px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="bc-btn bc-btn-primary"
              disabled={loading || orderItems.length === 0}
              style={{ marginTop: '14px' }}
            >
              {loading ? 'Processing…' : 'Checkout'}
            </button>
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 980px) {
                .bc-pos-grid { grid-template-columns: 1fr !important; }
              }
            `,
          }}
        />
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '520px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Sale created</div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: colors.textSecondary }}>
              Payment status: <strong style={{ color: colors.text }}>{paymentStatus.toUpperCase()}</strong>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button type="button" className="bc-btn bc-btn-primary" onClick={handlePrintReceipt} style={{ width: 'auto' }}>
                Print Receipt
              </button>
              <button type="button" className="bc-btn bc-btn-outline" onClick={handleTogglePayment} style={{ width: 'auto' }}>
                Mark as {paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
              </button>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeSuccessModal} style={{ width: 'auto' }}>
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
