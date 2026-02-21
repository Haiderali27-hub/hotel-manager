import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type ActiveGuestRow,
    type MenuItem,
    type OrderItem,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface AddFoodOrderProps {
  onBack: () => void;
  onChanged: () => void;
}

type ItemWithMeta = OrderItem & { name: string; total: number };

const AddFoodOrder: React.FC<AddFoodOrderProps> = ({ onBack, onChanged }) => {
  const { showError, showSuccess } = useNotification();
  const [customerType, setCustomerType] = useState<'active' | 'walkin'>('active');
  const [selectedGuestId, setSelectedGuestId] = useState(0);
  const [walkInName, setWalkInName] = useState('Walk-in');
  const [guests, setGuests] = useState<ActiveGuestRow[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [itemId, setItemId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<ItemWithMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([hotelRestaurantService.getActiveGuests(), hotelRestaurantService.getMenuItems()])
      .then(([guestRows, menuRows]) => {
        setGuests(guestRows);
        setMenu(menuRows.filter((menuItem) => menuItem.is_available));
      })
      .catch((error) => showError('Failed to load order data', String(error)));
  }, [showError]);

  const total = useMemo(() => items.reduce((sum, row) => sum + row.total, 0), [items]);

  const addItem = () => {
    const menuItem = menu.find((row) => row.id === itemId);
    if (!menuItem || quantity <= 0) {
      showError('Invalid item', 'Please pick a menu item and quantity');
      return;
    }

    setItems((prev) => {
      const index = prev.findIndex((row) => row.menu_item_id === itemId);
      if (index >= 0) {
        const next = [...prev];
        next[index].quantity += quantity;
        next[index].total = next[index].quantity * next[index].unit_price;
        return next;
      }

      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          quantity,
          unit_price: menuItem.price,
          name: menuItem.name,
          total: menuItem.price * quantity,
        },
      ];
    });

    setItemId(0);
    setQuantity(1);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (items.length === 0) throw new Error('Add at least one item');
      if (customerType === 'active' && selectedGuestId <= 0) {
        throw new Error('Select an active guest');
      }

      const orderId = await hotelRestaurantService.addFoodOrder({
        guest_id: customerType === 'walkin' ? null : selectedGuestId,
        items: items.map((row) => ({
          menu_item_id: row.menu_item_id,
          item_name: row.name,
          quantity: row.quantity,
          unit_price: row.unit_price,
        })),
      });

      showSuccess(
        'Order created',
        `Order #${orderId} (${customerType === 'walkin' ? walkInName : 'Active guest'}) total ${total.toFixed(2)}`
      );
      onChanged();
      onBack();
    } catch (error) {
      showError('Failed to create order', String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Add Food Order</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 680 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <label>
            <input
              type="radio"
              checked={customerType === 'active'}
              onChange={() => setCustomerType('active')}
            /> Active Guest
          </label>
          <label>
            <input
              type="radio"
              checked={customerType === 'walkin'}
              onChange={() => setCustomerType('walkin')}
            /> Walk-in
          </label>
        </div>

        {customerType === 'active' ? (
          <select
            className="bc-input"
            value={selectedGuestId}
            onChange={(e) => setSelectedGuestId(Number(e.target.value))}
          >
            <option value={0}>Select active guest</option>
            {guests.map((guest) => (
              <option key={guest.guest_id} value={guest.guest_id}>
                {guest.name}{guest.room_number ? ` - Room ${guest.room_number}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="bc-input"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            placeholder="Walk-in name"
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: 8 }}>
          <select className="bc-input" value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
            <option value={0}>Select menu item</option>
            {menu.map((menuItem) => (
              <option key={menuItem.id} value={menuItem.id}>
                {menuItem.name} - {menuItem.price.toFixed(2)}
              </option>
            ))}
          </select>
          <input
            className="bc-input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <button className="bc-btn bc-btn-outline" type="button" onClick={addItem}>Add Item</button>
        </div>

        <div className="bc-card" style={{ padding: 12 }}>
          <strong>Order items</strong>
          {items.length === 0 ? (
            <p style={{ margin: '8px 0 0' }}>No items added yet.</p>
          ) : (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {items.map((row, index) => (
                <li key={`${row.menu_item_id}-${index}`}>
                  {row.name} x{row.quantity} = {row.total.toFixed(2)}
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 8 }}><strong>Total: {total.toFixed(2)}</strong></div>
        </div>

        <button className="bc-btn bc-btn-primary" disabled={loading} type="submit">
          {loading ? 'Saving...' : 'Create Order'}
        </button>
      </form>
    </div>
  );
};

export default AddFoodOrder;
