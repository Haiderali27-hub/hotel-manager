import React, { useEffect, useState } from 'react';
import type { Guest } from '../api/client';
import {
    checkoutGuest,
    getActiveGuests,
    getFoodOrdersByGuest,
    updateGuest
} from '../api/client';
import { useTheme } from '../context/ThemeContext';

interface ActiveGuestsProps {
  onBack: () => void;
  onAddOrder: (guestId: number) => void;
}

interface GuestWithOrders extends Guest {
  totalFoodOrders: number;
  stayDays: number;
}

const ActiveGuests: React.FC<ActiveGuestsProps> = ({ onBack, onAddOrder }) => {
  const { colors } = useTheme();
  const [guests, setGuests] = useState<GuestWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  
  // Edit form states
  const [editCheckoutDate, setEditCheckoutDate] = useState('');
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('');

  useEffect(() => {
    loadActiveGuests();
  }, []);

  const loadActiveGuests = async () => {
    setLoading(true);
    try {
      const activeGuests = await getActiveGuests();
      
      // Calculate additional data for each guest
      const guestsWithOrders = await Promise.all(
        activeGuests.map(async (guest) => {
          // Get food orders count
          let totalFoodOrders = 0;
          try {
            const orders = await getFoodOrdersByGuest(guest.id);
            totalFoodOrders = orders.length;
          } catch (err) {
            console.error('Error fetching food orders for guest:', guest.id, err);
          }

          // Calculate stay days
          const checkInDate = new Date(guest.check_in);
          const checkOutDate = guest.check_out ? new Date(guest.check_out) : new Date();
          const stayDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            ...guest,
            totalFoodOrders,
            stayDays: Math.max(1, stayDays) // Minimum 1 day
          };
        })
      );

      setGuests(guestsWithOrders);
      setError(null);
    } catch (err) {
      setError('Failed to load active guests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGuest = (guest: Guest) => {
    setEditingGuest(guest);
    setEditCheckoutDate(guest.check_out ? guest.check_out.split('T')[0] : ''); // Extract date part
    setEditRoomNumber(guest.room_id.toString());
    setEditDailyRate(guest.daily_rate.toString());
    setShowEditForm(true);
  };

  const handleUpdateGuest = async () => {
    if (!editingGuest || !editCheckoutDate || !editRoomNumber || !editDailyRate) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await updateGuest(editingGuest.id, {
        name: editingGuest.name,
        phone: editingGuest.phone,
        room_id: parseInt(editRoomNumber),
        check_in: editingGuest.check_in,
        check_out: editCheckoutDate,
        daily_rate: parseFloat(editDailyRate)
      });

      setShowEditForm(false);
      setEditingGuest(null);
      loadActiveGuests();
    } catch (err) {
      setError('Failed to update guest');
      console.error(err);
    }
  };

  const handleCheckoutGuest = async (guestId: number, guestName: string) => {
    if (confirm(`Are you sure you want to checkout ${guestName}?`)) {
      try {
        const today = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
        await checkoutGuest(guestId, today);
        loadActiveGuests();
      } catch (err) {
        setError('Failed to checkout guest');
        console.error(err);
      }
    }
  };

  const resetEditForm = () => {
    setEditingGuest(null);
    setEditCheckoutDate('');
    setEditRoomNumber('');
    setEditDailyRate('');
    setShowEditForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div style={{
      padding: '2rem',
      backgroundColor: colors.primary,
      minHeight: '100vh',
      color: colors.text
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <button
          onClick={onBack}
          style={{
            backgroundColor: colors.accent,
            color: '#FFFFFF',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>
          Active Guests
        </h1>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: colors.errorBg,
          color: colors.error,
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Active Guests Table */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 100px 200px 100px 150px 300px',
          backgroundColor: colors.secondary,
          padding: '1rem',
          fontWeight: '600',
          borderBottom: `1px solid ${colors.border}`,
          gap: '1rem'
        }}>
          <div>Guest Name</div>
          <div>Room No.</div>
          <div>Check-in / Check-out</div>
          <div>Stay Days</div>
          <div>Total Food Orders</div>
          <div>Actions</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Loading active guests...
          </div>
        ) : guests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>
            No active guests found
          </div>
        ) : (
          guests.map((guest, index) => (
            <div
              key={guest.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '200px 100px 200px 100px 150px 300px',
                padding: '1rem',
                borderBottom: index < guests.length - 1 ? `1px solid ${colors.border}` : 'none',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div style={{ fontWeight: '500' }}>{guest.name}</div>
              <div>Room {guest.room_id}</div>
              <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                <div>{formatDate(guest.check_in)}</div>
                <div>{guest.check_out ? formatDate(guest.check_out) : 'Open'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>{guest.stayDays}</div>
              <div style={{ textAlign: 'center' }}>{guest.totalFoodOrders}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleEditGuest(guest)}
                  style={{
                    backgroundColor: colors.warning,
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onAddOrder(guest.id)}
                  style={{
                    backgroundColor: colors.accent,
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Add Order
                </button>
                <button
                  onClick={() => handleCheckoutGuest(guest.id, guest.name)}
                  style={{
                    backgroundColor: colors.success,
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Checkout
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Guest Modal */}
      {showEditForm && editingGuest && (
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
            border: `1px solid ${colors.border}`,
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: colors.text }}>
              Edit Guest: {editingGuest.name}
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Check-out Date
              </label>
              <input
                type="date"
                value={editCheckoutDate}
                onChange={(e) => setEditCheckoutDate(e.target.value)}
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
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Room Number
              </label>
              <input
                type="number"
                value={editRoomNumber}
                onChange={(e) => setEditRoomNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '1rem'
                }}
                placeholder="Room number"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Daily Rate (RS)
              </label>
              <input
                type="number"
                value={editDailyRate}
                onChange={(e) => setEditDailyRate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '1rem'
                }}
                placeholder="Daily rate"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={resetEditForm}
                style={{
                  backgroundColor: colors.textMuted,
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateGuest}
                style={{
                  backgroundColor: colors.success,
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveGuests;
