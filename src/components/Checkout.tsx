import React, { useCallback, useEffect, useState } from 'react';
import {
    addSale,
    buildFinalInvoiceHtmlWithDiscount,
    checkoutGuestWithDiscount,
    deleteSale,
    getCustomerLoyaltyPoints,
    getLoyaltyConfig,
    getMenuItems,
    getSaleDetails,
    getSalesByCustomer,
    getTaxEnabled,
    getTaxRate,
    redeemLoyaltyPoints,
    toggleSalePayment,
    type ActiveCustomerRow,
    type MenuItem,
    type NewSale
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';
import { generateReceiptLink, openWhatsApp, type CartItem } from '../utils/whatsapp';

interface CheckoutProps {
    guest: ActiveCustomerRow;
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
}

interface DiscountInfo {
    type: 'flat' | 'percentage';
    amount: number;
    description: string;
}

const Checkout: React.FC<CheckoutProps> = ({ guest, onBack, onCheckoutComplete }) => {
    const { colors } = useTheme();
    const { showSuccess, showError, showWarning } = useNotification();
    const { currencyCode, formatMoney } = useCurrency();
    const { current: label } = useLabels();
    
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
    
    // Phase 5: Loyalty points states
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [showRedeemModal, setShowRedeemModal] = useState(false);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
    const [loyaltyConfig, setLoyaltyConfig] = useState<[number, number]>([0.1, 0.1]);

    const loadCheckoutData = useCallback(async () => {
        setLoading(true);
        try {
            const [orderSummaries, menu] = await Promise.all([
                getSalesByCustomer(guest.guest_id),
                getMenuItems()
            ]);
            
                        // Load tax settings and loyalty points
            try {
                const [taxEnabledResult, taxRateResult, points, config] = await Promise.all([
                    getTaxEnabled(),
                    getTaxRate(),
                    getCustomerLoyaltyPoints(guest.guest_id),
                    getLoyaltyConfig()
                ]);
                setTaxEnabled(taxEnabledResult);
                setTaxRate(taxRateResult);
                setLoyaltyPoints(points);
                setLoyaltyConfig(config);
            } catch (err) {
                console.error('Failed to load tax settings:', err);
                setTaxEnabled(false);
                setTaxRate(0);
                setLoyaltyPoints(0);
            }
            
            // Load detailed order information for each order
            const detailedOrders: FoodOrderWithDetails[] = [];
            for (const summary of orderSummaries) {
                try {
                    const orderDetails = await getSaleDetails(summary.id);
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
            console.error('Failed to load checkout data:', err);
            const errorMessage = 'Failed to load checkout data';
            setError(errorMessage);
            showError('Loading Error', errorMessage);
        } finally {
            setLoading(false);
        }
    }, [guest.check_in, guest.check_out, guest.daily_rate, guest.guest_id, showError]);

    const calculateTotals = useCallback(() => {
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
        
        // Calculate total after discount but before tax (including loyalty discount)
        const afterDiscount = Math.max(0, subtotal - discountAmount - loyaltyDiscount);
        
        // Calculate tax amount and final total
        let finalTotal = afterDiscount;
        if (taxEnabled && taxRate > 0) {
            finalTotal = afterDiscount * (1 + taxRate / 100);
        }
        
        setGrandTotal(finalTotal);
    }, [discount.amount, discount.type, foodOrders, roomCharges, taxEnabled, taxRate, loyaltyDiscount]);

    // Load data on mount / when guest changes
    useEffect(() => {
        void loadCheckoutData();
    }, [loadCheckoutData]);

    // Calculate totals when inputs change
    useEffect(() => {
        calculateTotals();
    }, [calculateTotals]);

    const handleTogglePayment = async (orderId: number) => {
        try {
            const result = await toggleSalePayment(orderId);
            showSuccess('Payment Status Updated', result);
            
            // Update local state
            setFoodOrders(prev => prev.map(order => 
                order.id === orderId 
                    ? { ...order, paid: !order.paid }
                    : order
            ));
            
        } catch (err) {
            console.error('Failed to toggle payment:', err);
            const errorMessage = 'Failed to update payment status';
            showError('Payment Update Failed', errorMessage);
        }
    };

    const handleDeleteOrder = async (orderId: number, orderDescription: string) => {
        if (!confirm(`Are you sure you want to delete this order: ${orderDescription}?`)) {
            return;
        }
        
        try {
            await deleteSale(orderId);
            showSuccess('Order Deleted', `Order has been removed`);
            
            // Remove from local state
            setFoodOrders(prev => prev.filter(order => order.id !== orderId));
            
        } catch (err) {
            console.error('Failed to delete order:', err);
            const errorMessage = 'Failed to delete order';
            showError('Delete Failed', errorMessage);
        }
    };

    const handleAddFoodItem = async () => {
        if (selectedMenuItemId === 0 || quantity <= 0) {
            showWarning('Invalid Selection', 'Please select an item and enter valid quantity');
            return;
        }

        const menuItem = menuItems.find(item => item.id === selectedMenuItemId);
        if (!menuItem) {
            showError('Item Not Found', 'Selected item not found');
            return;
        }

        try {
            const newOrder: NewSale = {
                guest_id: guest.guest_id,
                items: [{
                    menu_item_id: selectedMenuItemId,
                    item_name: menuItem.name,
                    quantity: quantity,
                    unit_price: menuItem.price
                }]
            };

            await addSale(newOrder);
            showSuccess('Item Added', `${quantity}x ${menuItem.name} added to bill`);
            
            // Reload food orders
            loadCheckoutData();
            
            // Reset form
            setSelectedMenuItemId(0);
            setQuantity(1);
            setShowAddFood(false);
            
        } catch (err) {
            console.error('Failed to add food item:', err);
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
        if (!confirm(`Are you sure you want to ${label.actionOut.toLowerCase()} ${guest.name}? This action cannot be undone.`)) {
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
            
            showSuccess(`${label.actionOut} Complete`, `${label.actionOut} completed for ${guest.name}. Final bill: ${formatMoney(finalBill)}`);
            
            onCheckoutComplete();
            
        } catch (err) {
            console.error('Checkout failed:', err);
            const errorMessage = `Failed to ${label.actionOut.toLowerCase()} ${guest.name}`;
            showError(`${label.actionOut} Failed`, errorMessage);
        } finally {
            setCheckingOut(false);
        }
    };

    const calculateStayDays = () => {
        const checkInDate = new Date(guest.check_in);
        const checkOutDate = guest.check_out ? new Date(guest.check_out) : new Date();
        return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Phase 5: Loyalty Points Handler
    const handleRedeemPoints = async () => {
        if (pointsToRedeem <= 0) {
            showWarning('Invalid Points', 'Please enter a valid number of points to redeem');
            return;
        }

        if (pointsToRedeem > loyaltyPoints) {
            showError('Insufficient Points', `Customer only has ${loyaltyPoints} points available`);
            return;
        }

        try {
            const discountAmount = await redeemLoyaltyPoints(guest.guest_id, pointsToRedeem);
            
            setLoyaltyDiscount(discountAmount);
            setLoyaltyPoints(prev => prev - pointsToRedeem);
            setShowRedeemModal(false);
            setPointsToRedeem(0);
            
            showSuccess(
                'Points Redeemed', 
                `${pointsToRedeem} points redeemed for ${formatMoney(discountAmount)} discount`
            );
        } catch (err) {
            console.error('Failed to redeem points:', err);
            showError('Redemption Failed', err instanceof Error ? err.message : 'Failed to redeem points');
        }
    };

    // Phase 5: WhatsApp Receipt Handler
    const handleSendWhatsAppReceipt = () => {
        if (!guest.name) {
            showWarning('Missing Information', 'Customer name is required');
            return;
        }

        // Prompt for phone number if not available
        const phone = prompt('Enter customer phone number (with country code):');
        if (!phone) {
            return;
        }

        try {
            // Build cart items from unpaid orders
            const cartItems: CartItem[] = [];
            foodOrders.forEach(order => {
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        cartItems.push({
                            name: item.item_name,
                            quantity: item.quantity,
                            price: item.unit_price
                        });
                    });
                }
            });

            // Add room charges as an item
            if (roomCharges > 0) {
                const stayDays = calculateStayDays();
                cartItems.push({
                    name: `${label.unit} Charges (${stayDays} days)`,
                    quantity: 1,
                    price: roomCharges
                });
            }

            // Generate WhatsApp link
            const waLink = generateReceiptLink(
                phone,
                guest.name,
                cartItems,
                grandTotal,
                'Inertia Offline', // You can get this from settings later
                currencyCode
            );

            // Open WhatsApp
            openWhatsApp(waLink);
            showSuccess('WhatsApp Opened', 'Receipt message prepared in WhatsApp');
        } catch (err) {
            console.error('Failed to generate WhatsApp link:', err);
            showError('WhatsApp Error', err instanceof Error ? err.message : 'Failed to generate WhatsApp message');
        }
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
                <div>Loading billing information...</div>
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
                    <h1 style={{ margin: 0 }}>{label.actionOut} - {guest.name}</h1>
                </div>
                
                <div style={{ 
                    background: colors.surface,
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`
                }}>
                    {guest.room_number ? `${label.unit} ${guest.room_number}` : `Walk-in`}
                </div>
            </div>

            {/* Phase 5: Loyalty Points Display */}
            {loyaltyPoints > 0 && (
                <div style={{
                    backgroundColor: '#FEF3C7',
                    border: '2px solid #F59E0B',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>💎</span>
                        <div>
                            <div style={{ 
                                fontWeight: 'bold', 
                                fontSize: '1.1rem',
                                color: '#92400E'
                            }}>
                                {loyaltyPoints} Loyalty Points
                            </div>
                            <div style={{ 
                                fontSize: '0.85rem',
                                color: '#78350F'
                            }}>
                                Value: {formatMoney(loyaltyPoints * loyaltyConfig[1])}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRedeemModal(true)}
                        disabled={loyaltyDiscount > 0}
                        style={{
                            backgroundColor: loyaltyDiscount > 0 ? '#D1D5DB' : '#F59E0B',
                            color: loyaltyDiscount > 0 ? '#6B7280' : 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: loyaltyDiscount > 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {loyaltyDiscount > 0 ? '✓ Redeemed' : 'Redeem Points'}
                    </button>
                </div>
            )}

            {/* Phase 5: Redeem Points Modal */}
            {showRedeemModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: colors.primary,
                        padding: '32px',
                        borderRadius: '16px',
                        border: `2px solid ${colors.border}`,
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                    }}>
                        <h2 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '24px', fontWeight: 700 }}>Redeem Loyalty Points</h2>
                        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '20px' }}>
                            Convert points to discount
                        </div>
                        
                        <div style={{ marginBottom: '1rem', color: colors.text }}>
                            <p>
                                <strong>{guest.name}</strong> has <strong style={{ color: '#F59E0B' }}>{loyaltyPoints} points</strong>
                            </p>
                            <p style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                                Estimated value: {formatMoney(loyaltyPoints * loyaltyConfig[1])}
                            </p>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px',
                                fontWeight: 600,
                                fontSize: '14px',
                                color: colors.text
                            }}>
                                Points to Redeem:
                            </label>
                            <input
                                type="number"
                                min="0"
                                max={loyaltyPoints}
                                value={pointsToRedeem}
                                onChange={(e) => setPointsToRedeem(Math.min(loyaltyPoints, Math.max(0, parseInt(e.target.value) || 0)))}
                                onFocus={handleNumberInputFocus}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '10px',
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    fontSize: '15px'
                                }}
                            />
                            {pointsToRedeem > 0 && (
                                <div style={{ 
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    backgroundColor: '#D1FAE5',
                                    borderRadius: '4px',
                                    color: '#065F46',
                                    fontSize: '0.9rem'
                                }}>
                                    Discount: <strong>{formatMoney(pointsToRedeem * loyaltyConfig[1])}</strong>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowRedeemModal(false);
                                    setPointsToRedeem(0);
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: 'transparent',
                                    color: colors.text,
                                    border: `1px solid ${colors.border}`,
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    fontWeight: 600
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRedeemPoints}
                                disabled={pointsToRedeem <= 0}
                                style={{
                                    flex: 1,
                                    backgroundColor: pointsToRedeem > 0 ? '#F59E0B' : '#D1D5DB',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    cursor: pointsToRedeem > 0 ? 'pointer' : 'not-allowed',
                                    fontSize: '15px',
                                    fontWeight: 600
                                }}
                            >
                                Apply Discount
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div style={{
                    backgroundColor: colors.errorBg,
                    color: colors.error,
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
                        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>{label.unit} Charges</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ color: colors.textSecondary }}>
                                    {calculateStayDays()} days × {formatMoney(guest.daily_rate)}/day
                                </div>
                                <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                                    {label.action}: {new Date(guest.check_in).toLocaleDateString()}
                                    {guest.check_out && ` → ${label.actionOut}: ${new Date(guest.check_out).toLocaleDateString()}`}
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
                            <h3 style={{ margin: 0, color: colors.text }}>Sales</h3>
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
                                + Add Item
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
                                            Item
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
                                            onFocus={handleNumberInputFocus}
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
                                            backgroundColor: colors.success,
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
                                No sales found
                            </div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {foodOrders.map(order => (
                                    <div key={order.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        border: `2px solid ${order.paid ? colors.success : colors.error}`,
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem',
                                        backgroundColor: order.paid ? colors.surface : colors.warningBg,
                                        opacity: order.paid ? 0.7 : 1
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                Order #{order.id}
                                                <span style={{
                                                    backgroundColor: order.paid ? colors.success : colors.error,
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
                                                    backgroundColor: order.paid ? colors.success : colors.error,
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
                                                    backgroundColor: colors.error,
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
                                onFocus={handleNumberInputFocus}
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
                            <span>{label.unit} Charges:</span>
                            <span>{formatMoney(roomCharges)}</span>
                        </div>
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '0.5rem',
                            paddingBottom: '0.5rem',
                            borderBottom: `1px solid ${colors.border}`
                        }}>
                            <span>Unpaid Sales:</span>
                            <span>{formatMoney(unpaidFoodTotal)}</span>
                        </div>
                        
                        {discount.amount > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '0.5rem',
                                paddingBottom: '0.5rem',
                                borderBottom: `1px solid ${colors.border}`,
                                color: colors.success
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
                        
                        {/* Phase 5: Loyalty Discount Display */}
                        {loyaltyDiscount > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '0.5rem',
                                paddingBottom: '0.5rem',
                                borderBottom: `1px solid ${colors.border}`,
                                color: '#F59E0B',
                                fontWeight: 'bold'
                            }}>
                                <span>💎 Loyalty Discount:</span>
                                <span>-{formatMoney(loyaltyDiscount)}</span>
                            </div>
                        )}
                        
                        {taxEnabled && taxRate > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '0.5rem',
                                paddingBottom: '0.5rem',
                                borderBottom: `1px solid ${colors.border}`,
                                color: colors.accent
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
                        {/* Phase 5: WhatsApp Send Receipt Button */}
                        <button
                            onClick={handleSendWhatsAppReceipt}
                            style={{
                                backgroundColor: '#25D366',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>📱</span>
                            Send Receipt via WhatsApp
                        </button>
                        
                        <button
                            onClick={handlePrintInvoice}
                            style={{
                                backgroundColor: colors.accent,
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
                                backgroundColor: checkingOut ? colors.textMuted : colors.success,
                                color: 'white',
                                border: 'none',
                                padding: '1rem',
                                borderRadius: '4px',
                                cursor: checkingOut ? 'not-allowed' : 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {checkingOut ? '⏳ Processing...' : `✅ Confirm ${label.actionOut}`}
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
                        <strong>Note:</strong> All orders will appear on the receipt. 
                        Only unpaid orders are included in the total amount.
                        {taxEnabled && (
                            <><br/><strong>Tax:</strong> {taxRate}% tax is applied to the final total.</>
                        )}
                        <br/><strong>Tip:</strong> Configure tax settings in Manage Catalog Resources → Settings tab.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
