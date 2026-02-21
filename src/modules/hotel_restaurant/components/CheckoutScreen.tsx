import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type ActiveGuestRow,
    type FoodOrderSummary,
    type MenuItem,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface CheckoutScreenProps {
  guest: ActiveGuestRow;
  onBack: () => void;
  onCheckoutComplete: () => void;
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ guest, onBack, onCheckoutComplete }) => {
  const { showError, showSuccess } = useNotification();
  const [orders, setOrders] = useState<FoodOrderSummary[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountDescription, setDiscountDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [guestOrders, items] = await Promise.all([
        hotelRestaurantService.getFoodOrdersByGuest(guest.guest_id),
        hotelRestaurantService.getMenuItems(),
      ]);
      setOrders(guestOrders);
      setMenuItems(items.filter((item) => item.is_available));
    } catch (error) {
      showError('Failed to load checkout data', String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [guest.guest_id]);

  const unpaidTotal = useMemo(
    () => orders.filter((order) => !order.paid).reduce((sum, order) => sum + order.total_amount, 0),
    [orders]
  );

  const stayDays = useMemo(() => {
    const start = new Date(guest.check_in);
    const end = guest.check_out ? new Date(guest.check_out) : new Date();
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [guest.check_in, guest.check_out]);

  const roomCharges = stayDays * guest.daily_rate;
  const subtotal = roomCharges + unpaidTotal;
  const discountValue = Number(discountAmount) || 0;
  const discountApplied = discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue;
  const total = Math.max(0, subtotal - discountApplied);

  const addQuickFood = async (menuItemId: number) => {
    const item = menuItems.find((row) => row.id === menuItemId);
    if (!item) return;

    try {
      await hotelRestaurantService.addFoodOrder({
        guest_id: guest.guest_id,
        items: [
          {
            menu_item_id: item.id,
            item_name: item.name,
            quantity: 1,
            unit_price: item.price,
          },
        ],
      });
      showSuccess('Food item added to checkout bill');
      await load();
    } catch (error) {
      showError('Failed to add food item', String(error));
    }
  };

  const togglePayment = async (orderId: number) => {
    try {
      await hotelRestaurantService.toggleFoodOrderPayment(orderId);
      await load();
      showSuccess('Payment status updated');
    } catch (error) {
      showError('Failed to update payment', String(error));
    }
  };

  const printInvoice = async () => {
    try {
      const html = await hotelRestaurantService.buildFinalInvoiceHtmlWithDiscount(
        guest.guest_id,
        discountType,
        discountValue,
        discountDescription
      );
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showError('Popup blocked while printing invoice');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch (error) {
      showError('Failed to print invoice', String(error));
    }
  };

  const confirmCheckout = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await hotelRestaurantService.checkoutGuestWithDiscount(
        guest.guest_id,
        today,
        discountType,
        discountValue,
        discountDescription
      );
      showSuccess(`Checked out ${guest.name}`);
      onCheckoutComplete();
    } catch (error) {
      showError('Checkout failed', String(error));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Checkout - {guest.name}</h2>

      {loading ? (
        <div className="bc-card" style={{ padding: 14 }}>Loading checkout details...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
          <div className="bc-card" style={{ padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Unpaid Food Orders</h4>
            {orders.length === 0 ? (
              <p>No orders</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {orders.map((order) => (
                  <div key={order.id} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Order #{order.id}</strong>
                      <span>{order.total_amount.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Created: {new Date(order.created_at).toLocaleString()}</div>
                    <div style={{ marginTop: 6 }}>
                      <button className="bc-btn bc-btn-outline" onClick={() => togglePayment(order.id)}>
                        Mark as {order.paid ? 'Unpaid' : 'Paid'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ marginBottom: 8 }}>Quick Add Food</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <select className="bc-input" defaultValue="" onChange={(e) => addQuickFood(Number(e.target.value))}>
                <option value="">Select item</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - {item.price.toFixed(2)}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, alignSelf: 'center' }}>Adds qty=1</span>
            </div>
          </div>

          <div className="bc-card" style={{ padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Final Bill</h4>
            <div>Stay: {stayDays} day(s)</div>
            <div>Room charges: {roomCharges.toFixed(2)}</div>
            <div>Unpaid food: {unpaidTotal.toFixed(2)}</div>
            <div>Subtotal: {subtotal.toFixed(2)}</div>

            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <select
                className="bc-input"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percentage')}
              >
                <option value="flat">Flat Discount</option>
                <option value="percentage">Percentage Discount</option>
              </select>
              <input
                className="bc-input"
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="Discount amount"
              />
              <input
                className="bc-input"
                value={discountDescription}
                onChange={(e) => setDiscountDescription(e.target.value)}
                placeholder="Discount description"
              />
            </div>

            <div style={{ marginTop: 8 }}>Discount: -{discountApplied.toFixed(2)}</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>Total: {total.toFixed(2)}</div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="bc-btn bc-btn-outline" onClick={printInvoice}>Print Invoice</button>
              <button className="bc-btn bc-btn-primary" onClick={confirmCheckout}>Confirm Checkout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutScreen;
