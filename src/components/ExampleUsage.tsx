import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';

// Types - you can import these from your api/client.ts
interface Room {
  id: number;
  number: string;
  is_active: boolean;
}

interface DashboardStats {
  total_guests_this_month: number;
  total_income: number;
  total_expenses: number;
  profit_loss: number;
  total_food_orders: number;
  active_guests: number;
}

const ExampleUsage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch rooms
      const roomsData = await invoke('get_rooms') as Room[];
      setRooms(roomsData);

      // Fetch dashboard stats
      const statsData = await invoke('dashboard_stats') as DashboardStats;
      setStats(statsData);

    } catch (err) {
      setError(err as string);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRoom = async () => {
    try {
      const roomNumber = prompt('Enter room number:');
      if (!roomNumber) return;

      await invoke('add_room', { number: roomNumber });
      await fetchData(); // Refresh data
      alert('Room added successfully!');
    } catch (err) {
      alert(`Error adding room: ${err}`);
    }
  };

  const addGuest = async () => {
    try {
      const name = prompt('Enter guest name:');
      if (!name) return;

      // For demo - you'd get these from a form
      await invoke('add_guest', {
        name,
        phone: '123-456-7890',
        room_id: rooms[0]?.id || 1,
        check_in: '2025-08-16',
        check_out: null,
        daily_rate: 100.0
      });

      await fetchData(); // Refresh data
      alert('Guest added successfully!');
    } catch (err) {
      alert(`Error adding guest: ${err}`);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Hotel Management System - Demo</h1>
      
      {/* Dashboard Stats */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Dashboard Statistics</h2>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>Active Guests: {stats.active_guests}</div>
            <div>Monthly Income: ${stats.total_income.toFixed(2)}</div>
            <div>Monthly Expenses: ${stats.total_expenses.toFixed(2)}</div>
            <div>Profit/Loss: ${stats.profit_loss.toFixed(2)}</div>
            <div>Total Guests: {stats.total_guests_this_month}</div>
            <div>Food Orders: {stats.total_food_orders}</div>
          </div>
        )}
      </div>

      {/* Rooms */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Rooms</h2>
        <button onClick={addRoom} style={{ marginBottom: '10px', padding: '5px 10px' }}>
          Add Room
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {rooms.map(room => (
            <div key={room.id} style={{ 
              padding: '10px', 
              border: '1px solid #ddd', 
              borderRadius: '3px',
              backgroundColor: room.is_active ? '#f0f8ff' : '#ffe4e1'
            }}>
              <strong>Room {room.number}</strong>
              <br />
              Status: {room.is_active ? 'Active' : 'Inactive'}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={addGuest} style={{ padding: '8px 15px' }}>
            Add Guest (Demo)
          </button>
          <button onClick={fetchData} style={{ padding: '8px 15px' }}>
            Refresh Data
          </button>
          <button 
            onClick={() => invoke('get_menu_items').then(console.log)} 
            style={{ padding: '8px 15px' }}
          >
            Log Menu Items
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
        <h3>For Frontend Developer:</h3>
        <p>This component demonstrates how to:</p>
        <ul>
          <li>Call backend APIs using <code>invoke()</code></li>
          <li>Handle loading and error states</li>
          <li>Update UI based on API responses</li>
          <li>Trigger actions (add room, add guest)</li>
        </ul>
        <p>Replace this with your actual UI components and forms!</p>
      </div>
    </div>
  );
};

export default ExampleUsage;
