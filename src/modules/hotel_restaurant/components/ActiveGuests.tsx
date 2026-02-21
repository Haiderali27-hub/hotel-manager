import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type ActiveGuestRow,
    type FoodOrderSummary,
    type Room,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface ActiveGuestsProps {
  onBack: () => void;
  onChanged: () => void;
  onCheckoutGuest?: (guest: ActiveGuestRow) => void;
}

type GuestWithOrders = ActiveGuestRow & {
  foodOrders: FoodOrderSummary[];
  unpaidFoodTotal: number;
  stayDays: number;
  totalDue: number;
};

const ActiveGuests: React.FC<ActiveGuestsProps> = ({ onBack, onChanged, onCheckoutGuest }) => {
  const { showError, showSuccess } = useNotification();
  const [rows, setRows] = useState<GuestWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [editName, setEditName] = useState('');
  const [editRoomId, setEditRoomId] = useState(0);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('0');

  const load = async () => {
    setLoading(true);
    try {
      const activeGuests = await hotelRestaurantService.getActiveGuests();
      const withOrders = await Promise.all(
        activeGuests.map(async (guest) => {
          const orders = await hotelRestaurantService.getFoodOrdersByGuest(guest.guest_id);
          const unpaidFoodTotal = orders
            .filter((order) => !order.paid)
            .reduce((sum, order) => sum + order.total_amount, 0);

          const start = new Date(guest.check_in);
          const end = guest.check_out ? new Date(guest.check_out) : new Date();
          const stayDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
          const totalDue = stayDays * guest.daily_rate + unpaidFoodTotal;

          return {
            ...guest,
            foodOrders: orders,
            unpaidFoodTotal,
            stayDays,
            totalDue,
          };
        })
      );
      setRows(withOrders);
    } catch (error) {
      showError('Failed to load active guests', String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const beginEdit = async (guest: GuestWithOrders) => {
    setEditingGuestId(guest.guest_id);
    setEditName(guest.name);
    setEditCheckIn(guest.check_in);
    setEditCheckOut(guest.check_out ?? '');
    setEditDailyRate(String(guest.daily_rate));

    try {
      const rooms = await hotelRestaurantService.getAvailableRoomsForGuest(guest.guest_id);
      setAvailableRooms(rooms);
      const selected = rooms.find((room) => room.number === guest.room_number);
      setEditRoomId(selected?.id ?? 0);
    } catch (error) {
      showError('Failed to load available rooms', String(error));
    }
  };

  const saveEdit = async () => {
    if (editingGuestId === null) return;
    try {
      await hotelRestaurantService.updateGuest(editingGuestId, {
        name: editName,
        room_id: editRoomId || undefined,
        check_in: editCheckIn,
        check_out: editCheckOut || undefined,
        daily_rate: Number(editDailyRate),
      });
      showSuccess('Guest updated successfully');
      setEditingGuestId(null);
      await load();
      onChanged();
    } catch (error) {
      showError('Failed to update guest', String(error));
    }
  };

  const checkout = async (guest: GuestWithOrders) => {
    if (onCheckoutGuest) {
      onCheckoutGuest(guest);
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);
      await hotelRestaurantService.checkoutGuest(guest.guest_id, today);
      showSuccess(`Checked out ${guest.name}`);
      await load();
      onChanged();
    } catch (error) {
      showError('Checkout failed', String(error));
    }
  };

  const roomGuests = useMemo(() => rows.filter((guest) => !guest.is_walkin), [rows]);
  const walkIns = useMemo(() => rows.filter((guest) => guest.is_walkin), [rows]);
  const sections: Array<{ title: string; list: GuestWithOrders[] }> = [
    { title: 'Room Guests', list: roomGuests },
    { title: 'Walk-in Customers', list: walkIns },
  ];

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Active Guests</h2>

      {loading ? (
        <div className="bc-card" style={{ padding: 16 }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sections.map(({ title, list }) => (
            <div key={title} className="bc-card" style={{ padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>{title} ({list.length})</h4>
              {list.length === 0 ? (
                <p>No entries</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {list.map((guest) => (
                    <div key={guest.guest_id} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <strong>{guest.name}</strong>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            {guest.room_number ? `Room ${guest.room_number}` : 'Walk-in'} • {guest.stayDays} day(s)
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            Unpaid food: {guest.unpaidFoodTotal.toFixed(2)} • Total due: {guest.totalDue.toFixed(2)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="bc-btn bc-btn-outline" onClick={() => beginEdit(guest)}>Edit</button>
                          <button className="bc-btn bc-btn-primary" onClick={() => checkout(guest)}>Checkout</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingGuestId !== null && (
        <div className="bc-card" style={{ padding: 12, marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Edit guest</h4>
          <div style={{ display: 'grid', gap: 8, maxWidth: 540 }}>
            <input className="bc-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
            <select className="bc-input" value={editRoomId} onChange={(e) => setEditRoomId(Number(e.target.value))}>
              <option value={0}>No room / keep current</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>{room.number} - {room.room_type}</option>
              ))}
            </select>
            <input className="bc-input" type="date" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
            <input className="bc-input" type="date" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
            <input className="bc-input" type="number" value={editDailyRate} onChange={(e) => setEditDailyRate(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="bc-btn bc-btn-primary" onClick={saveEdit}>Save</button>
              <button className="bc-btn bc-btn-outline" onClick={() => setEditingGuestId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveGuests;
