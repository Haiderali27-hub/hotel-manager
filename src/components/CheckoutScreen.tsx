import React, { useEffect, useState } from 'react';
import {
    addFoodOrder,
    buildFinalInvoiceHtmlWithDiscount,
    checkoutGuestWithDiscount,
    deleteFoodOrder,
    getFoodOrdersByGuest,
    getMenuItems,
    getOrderDetails,
    getTaxEnabled,
    getTaxRate,
    toggleFoodOrderPayment,
    type ActiveGuestRow,
    type MenuItem,
    type NewFoodOrder
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface CheckoutScreenProps {
    guest: ActiveGuestRow;
    onBack: () => void;
    onClose: () => void;
    onCheckoutComplete: () => void;
}

interface FoodOrderWithDetails {
  id: number;
  created_at: string;
  paid: boolean;
  paid_at?: string;
  total_amount: number;
  items: {
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}interface DiscountInfo {
    type: 'flat' | 'percentage';
    amount: number;
    description: string;
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ guest, onBack, onClose: _onClose, onCheckoutComplete }) => {
    const { colors } = useTheme();
    const { showSuccess, showError, showWarning } = useNotification();
    const { currencyCode, formatMoney } = useCurrency();
    
    // Main data states
    const [foodOrders, setFoodOrders] = useState<FoodOrderWithDetails[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Calculation states
    const [roomCharges, setRoomCharges] = useState(0);
    const [unpaidFoodTotal, setUnpaidFoodTotal] = useState(0);
    const [discount, setDiscount] = useState<DiscountInfo>({ type: 'flat', amount: 0, description: '' });
    const [grandTotal, setGrandTotal] = useState(0);
    
    // Tax states
    const [taxEnabled, setTaxEnabled] = useState(false);
    const [taxRate, setTaxRate] = useState(0);
    
    // UI states
    const [showAddFood, setShowAddFood] = useState(false);
    const [selectedMenuItemId, setSelectedMenuItemId] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [checkingOut, setCheckingOut] = useState(false);

    // Load data on component mount
    useEffect(() => {
        loadCheckoutData();
    }, [guest.guest_id]);

    // Calculate totals when dependencies change
    useEffect(() => {
        calculateTotals();
    }, [foodOrders, discount, roomCharges, taxEnabled, taxRate]);

    const loadCheckoutData = async () => {
        setLoading(true);
        try {
            const [orderSummaries, menu] = await Promise.all([
                getFoodOrdersByGuest(guest.guest_id),
                getMenuItems()
            ]);
            
                        // Load tax settings
            try {
                const [taxEnabledResult, taxRateResult] = await Promise.all([
                    getTaxEnabled(),
                    getTaxRate()
                ]);
                setTaxEnabled(taxEnabledResult);
                setTaxRate(taxRateResult);
            } catch (err) {
                console.error('Failed to load tax settings:', err);
                setTaxEnabled(false);
                setTaxRate(0);
            }
            
            // Load detailed order information for each order
            const detailedOrders: FoodOrderWithDetails[] = [];
            for (const summary of orderSummaries) {
                try {
                    const orderDetails = await getOrderDetails(summary.id);
                    const detailedOrder: FoodOrderWithDetails = {
                        id: summary.id,
                        created_at: summary.created_at,
                        paid: summary.paid,
                        paid_at: summary.paid_at,
                        total_amount: summary.total_amount,
                        items: orderDetails.items.map(item => ({
                            item_name: item.item_name,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            line_total: item.line_total
                        }))
                    };
                    detailedOrders.push(detailedOrder);
                } catch (err) {
                    console.error(`Failed to load details for order ${summary.id}:`, err);
                    // Add the order without detailed items if details fail to load
                    const fallbackOrder: FoodOrderWithDetails = {
                        id: summary.id,
                        created_at: summary.created_at,
                        paid: summary.paid,
                        paid_at: summary.paid_at,
                        total_amount: summary.total_amount,
                        items: []
                    };
                    detailedOrders.push(fallbackOrder);
                }
            }
            
            setFoodOrders(detailedOrders);
            setMenuItems(menu.filter(item => item.is_available));
            
            // Calculate room charges
            const checkInDate = new Date(guest.check_in);
            const checkOutDate = guest.check_out ? new Date(guest.check_out) : new Date();
            const stayDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
            const roomTotal = stayDays * guest.daily_rate;
            setRoomCharges(roomTotal);
            
            setError(null);
        } catch (err) {
            const errorMessage = 'Failed to load checkout data';
            setError(errorMessage);
            showError('Loading Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        // Calculate unpaid food orders total
        const unpaidTotal = foodOrders
            .filter(order => !order.paid)
            .reduce((sum, order) => sum + order.total_amount, 0);
        
        setUnpaidFoodTotal(unpaidTotal);
        
        // Calculate subtotal (before discount and tax)
        const subtotal = roomCharges + unpaidTotal;
        
        // Calculate discount amount
        let discountAmount = 0;
        if (discount.amount > 0) {
            if (discount.type === 'percentage') {
                discountAmount = (subtotal * discount.amount) / 100;
            } else {
                discountAmount = discount.amount;
            }
        }
        
        // Calculate total after discount but before tax
        const afterDiscount = Math.max(0, subtotal - discountAmount);
        
        // Calculate tax amount and final total
        let finalTotal = afterDiscount;
        if (taxEnabled && taxRate > 0) {
            finalTotal = afterDiscount * (1 + taxRate / 100);
        }
        
        setGrandTotal(finalTotal);
    };

    const handleTogglePayment = async (orderId: number) => {
        try {
            const result = await toggleFoodOrderPayment(orderId);
            showSuccess('Payment Status Updated', result);
            
            // Update local state
            setFoodOrders(prev => prev.map(order => 
                order.id === orderId 
                    ? { ...order, paid: !order.paid }
                    : order
            ));
            
        } catch (err) {
            const errorMessage = 'Failed to update payment status';
            showError('Payment Update Failed', errorMessage);
        }
    };

    const handleDeleteOrder = async (orderId: number, orderDescription: string) => {
        if (!confirm(`Are you sure you want to delete this food order: ${orderDescription}?`)) {
            return;
        }
        
        try {
            await deleteFoodOrder(orderId);
            showSuccess('Order Deleted', `Food order has been removed`);
            
            // Remove from local state
            setFoodOrders(prev => prev.filter(order => order.id !== orderId));
            
        } catch (err) {
            const errorMessage = 'Failed to delete food order';
            showError('Delete Failed', errorMessage);
        }
    };

    const handleAddFoodItem = async () => {
        if (selectedMenuItemId === 0 || quantity <= 0) {
            showWarning('Invalid Selection', 'Please select a menu item and enter valid quantity');
            return;
        }

        const menuItem = menuItems.find(item => item.id === selectedMenuItemId);
        if (!menuItem) {
            showError('Item Not Found', 'Selected menu item not found');
            return;
        }

        try {
            const newOrder: NewFoodOrder = {
                guest_id: guest.guest_id,
                items: [{
                    menu_item_id: selectedMenuItemId,
                    item_name: menuItem.name,
                    quantity: quantity,
                    unit_price: menuItem.price
                }]
            };

            await addFoodOrder(newOrder);
            showSuccess('Food Item Added', `${quantity}x ${menuItem.name} added to bill`);
            
            // Reload food orders
            loadCheckoutData();
            
            // Reset form
            setSelectedMenuItemId(0);
            setQuantity(1);
            setShowAddFood(false);
            
        } catch (err) {
            const errorMessage = 'Failed to add food item';
            showError('Add Failed', errorMessage);
        }
    };

    const handlePrintInvoice = async () => {
        try {
            const invoiceHtml = await buildFinalInvoiceHtmlWithDiscount(
                guest.guest_id,
                discount.type,
                discount.amount,
                discount.description
            );
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(invoiceHtml);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
                showSuccess('Invoice Printed', 'Final invoice has been sent to printer');
            } else {
                showWarning('Print Window Blocked', 'Please allow popups to print invoices');
            }
        } catch (err) {
            console.error('Print invoice error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate invoice';
            showError('Print Failed', errorMessage);
        }
    };

    const handleConfirmCheckout = async () => {
        if (!confirm(`Are you sure you want to checkout ${guest.name}? This action cannot be undone.`)) {
            return;
        }

        setCheckingOut(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const finalBill = await checkoutGuestWithDiscount(
                guest.guest_id, 
                today,
                discount.type,
                discount.amount,
                discount.description
            );
            
            showSuccess(
                'Checkout Complete', 
                `${guest.name} has been checked out. Final bill: ${formatMoney(finalBill)}`
            );
            
            onCheckoutComplete();
            
        } catch (err) {
            const errorMessage = `Failed to checkout ${guest.name}`;
            showError('Checkout Failed', errorMessage);
        } finally {
            setCheckingOut(false);
        }
    };

    const calculateStayDays = () => {
        const checkInDate = new Date(guest.check_in);
        const checkOutDate = guest.check_out ? new Date(guest.check_out) : new Date();
        return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <div style={{
                padding: '2rem',
                backgroundColor: colors.primary,
                color: colors.text,
                minHeight: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div>Loading checkout information...</div>
            </div>
        );
    }

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
                justifyContent: 'space-between',
                marginBottom: '2rem',
                borderBottom: `1px solid ${colors.border}`,
                paddingBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: colors.text,
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            marginRight: '1rem'
                        }}
                    >
                        ←
                    </button>
                    <h1 style={{ margin: 0 }}>Checkout - {guest.name}</h1>
                </div>
                
                <div style={{ 
                    background: colors.surface,
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`
                }}>
                    {guest.room_number ? `Room ${guest.room_number}` : 'Walk-in Customer'}
                </div>
            </div>

            {error && (
                <div style={{
                    backgroundColor: '#fee',
                    color: '#c33',
                    padding: '1rem',
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
                {/* Left Column - Order Details */}
                <div>
                    {/* Room Charges Section */}
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '1.5rem',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        marginBottom: '1.5rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>Room Charges</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ color: colors.textSecondary }}>
                                    {calculateStayDays()} days × {formatMoney(guest.daily_rate)}/day
                                </div>
                                <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                                    Check-in: {new Date(guest.check_in).toLocaleDateString()}
                                    {guest.check_out && ` → Check-out: ${new Date(guest.check_out).toLocaleDateString()}`}
                                </div>
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                {formatMoney(roomCharges)}
                            </div>
                        </div>
                    </div>

                    {/* Food Orders Section */}
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '1.5rem',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: colors.text }}>Food Orders</h3>
                            <button
                                onClick={() => setShowAddFood(!showAddFood)}
                                style={{
                                    backgroundColor: colors.accent,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                + Add Food Item
                            </button>
                        </div>

                        {/* Add Food Form */}
                        {showAddFood && (
                            <div style={{
                                backgroundColor: colors.primary,
                                padding: '1rem',
                                borderRadius: '4px',
                                marginBottom: '1rem',
                                border: `1px solid ${colors.border}`
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                            Menu Item
                                        </label>
                                        <select
                                            value={selectedMenuItemId}
                                            onChange={(e) => setSelectedMenuItemId(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: `1px solid ${colors.border}`,
                                                borderRadius: '4px',
                                                backgroundColor: colors.surface,
                                                color: colors.text
                                            }}
                                        >
                                            <option value={0}>Select an item...</option>
                                            {menuItems.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} - {formatMoney(item.price)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                            Qty
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Number(e.target.value))}
                                            style={{
                                                width: '80px',
                                                padding: '0.5rem',
                                                border: `1px solid ${colors.border}`,
                                                borderRadius: '4px',
                                                backgroundColor: colors.surface,
                                                color: colors.text
                                            }}
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={handleAddFoodItem}
                                        style={{
                                            backgroundColor: colors.success || '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Food Orders List */}
                        {foodOrders.length === 0 ? (
                            <div style={{ 
                                textAlign: 'center', 
                                color: colors.textSecondary,
                                padding: '2rem 0' 
                            }}>
                                No food orders found
                            </div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {foodOrders.map(order => (
                                    <div key={order.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        border: `2px solid ${order.paid ? '#28a745' : '#dc3545'}`,
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem',
                                        backgroundColor: order.paid ? '#f8f9fa' : '#fff3cd',
                                        opacity: order.paid ? 0.7 : 1
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                Order #{order.id}
                                                <span style={{
                                                    backgroundColor: order.paid ? '#28a745' : '#dc3545',
                                                    color: 'white',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {order.paid ? 'PAID' : 'UNPAID'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                                                {new Date(order.created_at).toLocaleDateString()} at{' '}
                                                {new Date(order.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ 
                                                fontWeight: 'bold',
                                                textDecoration: order.paid ? 'line-through' : 'none'
                                            }}>
                                                {formatMoney(order.total_amount)}
                                            </div>
                                            
                                            <button
                                                onClick={() => handleTogglePayment(order.id)}
                                                style={{
                                                    backgroundColor: order.paid ? '#28a745' : '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    minWidth: '80px',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {order.paid ? '✓ Paid' : '❌ Mark Paid'}
                                            </button>
                                            
                                            <button
                                                onClick={() => handleDeleteOrder(order.id, `Order #${order.id}`)}
                                                style={{
                                                    backgroundColor: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Discount Section */}
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '1.5rem',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>Apply Discount (Optional)</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                                value={discount.type}
                                onChange={(e) => setDiscount(prev => ({ ...prev, type: e.target.value as 'flat' | 'percentage' }))}
                                style={{
                                    padding: '0.5rem',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '4px',
                                    backgroundColor: colors.surface,
                                    color: colors.text
                                }}
                            >
                                <option value="flat">Flat Amount</option>
                                <option value="percentage">Percentage</option>
                            </select>
                            
                            <input
                                type="number"
                                min="0"
                                step={discount.type === 'percentage' ? '0.1' : '1'}
                                max={discount.type === 'percentage' ? '100' : undefined}
                                value={discount.amount}
                                onChange={(e) => setDiscount(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                placeholder={discount.type === 'percentage' ? '0-100' : 'Amount'}
                                style={{
                                    padding: '0.5rem',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '4px',
                                    backgroundColor: colors.surface,
                                    color: colors.text
                                }}
                            />
                            
                            <span style={{ color: colors.textSecondary }}>
                                {discount.type === 'percentage' ? '%' : currencyCode}
                            </span>
                            
                            <input
                                type="text"
                                value={discount.description}
                                onChange={(e) => setDiscount(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Reason (optional)"
                                style={{
                                    padding: '0.5rem',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '4px',
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    width: '150px'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Bill Summary */}
                <div style={{
                    backgroundColor: colors.surface,
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    height: 'fit-content',
                    position: 'sticky',
                    top: '2rem'
                }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', textAlign: 'center', color: colors.text }}>
                        Final Bill Summary
                    </h3>
                    
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '0.5rem',
                            paddingBottom: '0.5rem',
                            borderBottom: `1px solid ${colors.border}`
                        }}>
                            <span>Room Charges:</span>
                            <span>{formatMoney(roomCharges)}</span>
                        </div>
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '0.5rem',
                            paddingBottom: '0.5rem',
                            borderBottom: `1px solid ${colors.border}`
                        }}>
                            <span>Unpaid Food Orders:</span>
                            <span>{formatMoney(unpaidFoodTotal)}</span>
                        </div>
                        
                        {discount.amount > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '0.5rem',
                                paddingBottom: '0.5rem',
                                borderBottom: `1px solid ${colors.border}`,
                                color: '#28a745'
                            }}>
                                <span>
                                    Discount {discount.description && `(${discount.description})`}:
                                </span>
                                <span>
                                    -{discount.type === 'percentage' 
                                        ? `${discount.amount}%` 
                                        : `${formatMoney(discount.amount)}`}
                                </span>
                            </div>
                        )}
                        
                        {taxEnabled && taxRate > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '0.5rem',
                                paddingBottom: '0.5rem',
                                borderBottom: `1px solid ${colors.border}`,
                                color: '#007bff'
                            }}>
                                <span>Tax ({taxRate}%):</span>
                                <span>
                                    {formatMoney(((roomCharges + unpaidFoodTotal - (discount.amount > 0 
                                        ? (discount.type === 'percentage' 
                                            ? ((roomCharges + unpaidFoodTotal) * discount.amount) / 100
                                            : discount.amount)
                                        : 0)) * taxRate) / 100)}
                                </span>
                            </div>
                        )}
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            marginTop: '1rem',
                            paddingTop: '1rem',
                            borderTop: `2px solid ${colors.border}`
                        }}>
                            <span>Grand Total:</span>
                            <span>{formatMoney(grandTotal)}</span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                        <button
                            onClick={handlePrintInvoice}
                            style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            🖨️ Print Final Invoice
                        </button>
                        
                        <button
                            onClick={handleConfirmCheckout}
                            disabled={checkingOut}
                            style={{
                                backgroundColor: checkingOut ? '#666' : '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '1rem',
                                borderRadius: '4px',
                                cursor: checkingOut ? 'not-allowed' : 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {checkingOut ? '⏳ Processing...' : '✅ Confirm Checkout'}
                        </button>
                    </div>
                    
                    <div style={{ 
                        marginTop: '1rem', 
                        padding: '0.75rem',
                        backgroundColor: colors.primary,
                        borderRadius: '4px',
                        border: `1px solid ${colors.border}`,
                        fontSize: '0.9rem',
                        color: colors.textSecondary 
                    }}>
                        <strong>Note:</strong> All food orders will appear on the receipt. 
                        Only unpaid orders are included in the total amount.
                        {taxEnabled && (
                            <><br/><strong>Tax:</strong> {taxRate}% tax is applied to the final total.</>
                        )}
                        <br/><strong>Tip:</strong> Configure tax settings in Manage Menu & Rooms → Settings tab.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutScreen;
