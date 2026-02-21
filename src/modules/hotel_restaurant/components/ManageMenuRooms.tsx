import React, { useEffect, useState } from 'react';
import {
    hotelRestaurantService,
    type MenuItem,
    type Room,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface ManageMenuRoomsProps {
  onBack: () => void;
  onChanged: () => void;
}

const ManageMenuRooms: React.FC<ManageMenuRoomsProps> = ({ onBack, onChanged }) => {
  const { showError, showSuccess } = useNotification();
  const [tab, setTab] = useState<'menu' | 'rooms' | 'settings'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Single Room');
  const [roomPrice, setRoomPrice] = useState('');
  const [taxRate, setTaxRate] = useState('5');
  const [taxEnabled, setTaxEnabled] = useState(true);

  const load = async () => {
    try {
      const [menuRows, roomRows, taxRateValue, taxEnabledValue] = await Promise.all([
        hotelRestaurantService.getMenuItems(),
        hotelRestaurantService.getRooms(),
        hotelRestaurantService.getTaxRate(),
        hotelRestaurantService.getTaxEnabled(),
      ]);
      setMenuItems(menuRows);
      setRooms(roomRows);
      setTaxRate(String(taxRateValue));
      setTaxEnabled(taxEnabledValue);
    } catch (error) {
      showError('Failed to load settings', String(error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addMenu = async () => {
    try {
      await hotelRestaurantService.addMenuItem({
        name: name.trim(),
        price: Number(price),
        category: 'Main Course',
        is_available: true,
      });
      setName('');
      setPrice('');
      showSuccess('Menu item added');
      await load();
      onChanged();
    } catch (error) {
      showError('Failed to add menu item', String(error));
    }
  };

  const addRoom = async () => {
    try {
      await hotelRestaurantService.addRoom({
        number: roomNumber.trim(),
        room_type: roomType,
        daily_rate: Number(roomPrice),
      });
      setRoomNumber('');
      setRoomPrice('');
      showSuccess('Room added');
      await load();
      onChanged();
    } catch (error) {
      showError('Failed to add room', String(error));
    }
  };

  const saveTax = async () => {
    try {
      await hotelRestaurantService.setTaxRate(Number(taxRate));
      await hotelRestaurantService.setTaxEnabled(taxEnabled);
      showSuccess('Tax settings saved');
    } catch (error) {
      showError('Failed to save tax settings', String(error));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Manage Menu / Rooms</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="bc-btn bc-btn-outline" onClick={() => setTab('menu')}>Menu</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setTab('rooms')}>Rooms</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setTab('settings')}>Tax Settings</button>
      </div>

      {tab === 'menu' && (
        <div className="bc-card" style={{ padding: 12 }}>
          <h4>Add menu item</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: 8, marginBottom: 8 }}>
            <input className="bc-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="bc-input" type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <button className="bc-btn bc-btn-primary" onClick={addMenu}>Add</button>
          </div>
          <ul style={{ paddingLeft: 18 }}>
            {menuItems.map((menuItem) => (
              <li key={menuItem.id}>{menuItem.name} - {menuItem.price.toFixed(2)}</li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'rooms' && (
        <div className="bc-card" style={{ padding: 12 }}>
          <h4>Add room</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 120px', gap: 8, marginBottom: 8 }}>
            <input className="bc-input" placeholder="Room Number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
            <input className="bc-input" placeholder="Room Type" value={roomType} onChange={(e) => setRoomType(e.target.value)} />
            <input className="bc-input" type="number" placeholder="Daily Rate" value={roomPrice} onChange={(e) => setRoomPrice(e.target.value)} />
            <button className="bc-btn bc-btn-primary" onClick={addRoom}>Add</button>
          </div>
          <ul style={{ paddingLeft: 18 }}>
            {rooms.map((room) => (
              <li key={room.id}>{room.number} - {room.room_type} ({room.daily_rate.toFixed(2)})</li>
            ))}
          </ul>
          <button
            className="bc-btn bc-btn-outline"
            onClick={async () => {
              try {
                const message = await hotelRestaurantService.cleanupSoftDeletedRooms();
                showSuccess('Cleanup complete', message);
                await load();
              } catch (error) {
                showError('Cleanup failed', String(error));
              }
            }}
          >
            Cleanup soft-deleted rooms
          </button>
        </div>
      )}

      {tab === 'settings' && (
        <div className="bc-card" style={{ padding: 12 }}>
          <h4>Tax settings</h4>
          <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
            <label>
              Tax enabled{' '}
              <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
            </label>
            <input className="bc-input" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            <button className="bc-btn bc-btn-primary" onClick={saveTax}>Save tax settings</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMenuRooms;
