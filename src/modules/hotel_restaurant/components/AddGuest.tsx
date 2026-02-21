import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type NewGuest,
    type Room,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';
import { useTheme } from '../../../context/ThemeContext';

interface AddGuestProps {
  onBack: () => void;
  onChanged: () => void;
}

const AddGuest: React.FC<AddGuestProps> = ({ onBack, onChanged }) => {
  const { colors } = useTheme();
  const { showError, showSuccess } = useNotification();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    room_id: 0,
    check_in: '',
    check_out: '',
    daily_rate: 0,
  });

  useEffect(() => {
    hotelRestaurantService
      .getRooms()
      .then((result) => setRooms(result.filter((room) => !room.is_occupied)))
      .catch((error) => showError('Failed to load rooms', String(error)));
  }, [showError]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === form.room_id),
    [rooms, form.room_id]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (!form.name.trim()) throw new Error('Guest name is required');
      if (!isWalkIn && !form.room_id) throw new Error('Please select a room');
      if (!form.check_in) throw new Error('Check-in date is required');

      const payload: NewGuest = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        room_id: isWalkIn ? undefined : form.room_id,
        check_in: form.check_in,
        check_out: form.check_out || undefined,
        daily_rate: isWalkIn ? 0 : form.daily_rate,
      };

      await hotelRestaurantService.addGuest(payload);
      showSuccess('Guest added', `${payload.name} created successfully`);
      onChanged();
      onBack();
    } catch (error) {
      showError('Failed to add guest', String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, color: colors.text }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Add Guest</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label>
          <input
            type="checkbox"
            checked={isWalkIn}
            onChange={(e) => {
              setIsWalkIn(e.target.checked);
              if (e.target.checked) {
                setForm((prev) => ({ ...prev, room_id: 0, check_out: '', daily_rate: 0 }));
              }
            }}
          />{' '}
          Walk-in customer
        </label>

        <input
          className="bc-input"
          placeholder="Guest name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          className="bc-input"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
        />

        {!isWalkIn && (
          <>
            <select
              className="bc-input"
              value={form.room_id}
              onChange={(e) => {
                const roomId = Number(e.target.value);
                const room = rooms.find((r) => r.id === roomId);
                setForm((prev) => ({ ...prev, room_id: roomId, daily_rate: room?.daily_rate ?? 0 }));
              }}
            >
              <option value={0}>Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} - {room.room_type}
                </option>
              ))}
            </select>

            <input
              className="bc-input"
              type="number"
              min={0}
              value={form.daily_rate}
              onChange={(e) => setForm((prev) => ({ ...prev, daily_rate: Number(e.target.value) }))}
            />
          </>
        )}

        <input
          className="bc-input"
          type="date"
          value={form.check_in}
          onChange={(e) => setForm((prev) => ({ ...prev, check_in: e.target.value }))}
        />

        {!isWalkIn && (
          <input
            className="bc-input"
            type="date"
            value={form.check_out}
            onChange={(e) => setForm((prev) => ({ ...prev, check_out: e.target.value }))}
          />
        )}

        {!isWalkIn && selectedRoom && (
          <small style={{ color: colors.textSecondary }}>
            Selected room: {selectedRoom.number} ({selectedRoom.room_type})
          </small>
        )}

        <button className="bc-btn bc-btn-primary" disabled={loading} type="submit">
          {loading ? 'Saving...' : 'Add Guest'}
        </button>
      </form>
    </div>
  );
};

export default AddGuest;
