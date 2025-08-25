import React, { useEffect, useState } from 'react';
import { addGuest, getRooms, type NewGuest, type Room } from '../api/client';
import { useTheme } from '../context/ThemeContext';

interface AddGuestProps {
  onBack: () => void;
  onGuestAdded: () => void;
  refreshTrigger?: number; // Optional prop to trigger room list refresh
}

const AddGuest: React.FC<AddGuestProps> = ({ onBack, onGuestAdded, refreshTrigger }) => {
  const { colors } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    room_id: 0,
    check_in: '',
    check_out: '',
    daily_rate: 0
  });
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available rooms on component mount and when refresh is triggered
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const allRooms = await getRooms();
        // Filter only available rooms (not occupied)
        const availableRooms = allRooms.filter(room => !room.is_occupied);
        setRooms(availableRooms);
      } catch (err) {
        console.error('Failed to load rooms:', err);
        setError('Failed to load available rooms');
      }
    };

    loadRooms();
  }, [refreshTrigger]); // Add refreshTrigger as dependency

  // Calculate number of days when dates change
  useEffect(() => {
    if (formData.check_in && formData.check_out) {
      const checkIn = new Date(formData.check_in);
      const checkOut = new Date(formData.check_out);
      const diffTime = checkOut.getTime() - checkIn.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        // Update the daily rate from selected room if available
        const selectedRoom = rooms.find(room => room.id === formData.room_id);
        if (selectedRoom && formData.daily_rate === 0) {
          setFormData(prev => ({ ...prev, daily_rate: selectedRoom.daily_rate }));
        }
      }
    }
  }, [formData.check_in, formData.check_out, formData.room_id, rooms]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'room_id') {
      const roomId = parseInt(value);
      const selectedRoom = rooms.find(room => room.id === roomId);
      setFormData(prev => ({
        ...prev,
        [name]: roomId,
        daily_rate: selectedRoom ? selectedRoom.daily_rate : 0
      }));
    } else if (name === 'daily_rate') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const calculateStayDays = () => {
    if (formData.check_in && formData.check_out) {
      const checkIn = new Date(formData.check_in);
      const checkOut = new Date(formData.check_out);
      const diffTime = checkOut.getTime() - checkIn.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Guest name is required');
      }
      if (formData.room_id === 0) {
        throw new Error('Please select a room');
      }
      if (!formData.check_in) {
        throw new Error('Check-in date is required');
      }
      if (!formData.check_out) {
        throw new Error('Check-out date is required');
      }

      const newGuest: NewGuest = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        room_id: formData.room_id,
        check_in: formData.check_in,
        check_out: formData.check_out,
        daily_rate: formData.daily_rate
      };

      const guestId = await addGuest(newGuest);
      console.log('✅ Guest added successfully:', guestId);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        room_id: 0,
        check_in: '',
        check_out: '',
        daily_rate: 0
      });

      onGuestAdded();
      onBack();
    } catch (err) {
      console.error('❌ Failed to add guest:', err);
      setError(err instanceof Error ? err.message : 'Failed to add guest');
    } finally {
      setLoading(false);
    }
  };

  const stayDays = calculateStayDays();

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
        marginBottom: '2rem',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '1rem'
      }}>
        <button
          onClick={onBack}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.accent,
            fontSize: '1.5rem',
            cursor: 'pointer',
            marginRight: '1rem',
            padding: '0.5rem'
          }}
        >
          ←
        </button>
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 'bold',
          margin: 0,
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Add New Guest
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        {/* Guest Name */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Guest name (required)
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '1rem'
            }}
            placeholder="Enter guest name"
          />
        </div>

        {/* Phone Number */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Phone number (required)
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '1rem'
            }}
            placeholder="Enter phone number"
          />
        </div>

        {/* Room Number */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Room Number
          </label>
          <select
            name="room_id"
            value={formData.room_id}
            onChange={handleInputChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            <option value={0}>Select a room</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>
                Room {room.number} - Rs.{room.daily_rate}/day
              </option>
            ))}
          </select>
        </div>

        {/* Check-in Date */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Check-in Date
          </label>
          <input
            type="date"
            name="check_in"
            value={formData.check_in}
            onChange={handleInputChange}
            required
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

        {/* Check-out Date */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Check-out Date
          </label>
          <input
            type="date"
            name="check_out"
            value={formData.check_out}
            onChange={handleInputChange}
            required
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

        {/* Daily Room Rate */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            Daily Room Rate
          </label>
          <input
            type="number"
            name="daily_rate"
            value={formData.daily_rate}
            onChange={handleInputChange}
            min="0"
            step="0.01"
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

        {/* Number of stays auto calculate */}
        {stayDays > 0 && (
          <div style={{
            padding: '1rem',
            backgroundColor: colors.card,
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ color: colors.text }}>
              <span>Number of stay days auto calculated: <strong>{stayDays} days</strong></span>
            </div>
            {formData.daily_rate > 0 && (
              <div style={{ marginTop: '0.5rem', color: colors.textSecondary }}>
                Total estimated cost: <strong>Rs.{(stayDays * formData.daily_rate).toLocaleString()}</strong>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: colors.errorBg,
            color: colors.error,
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: `1px solid ${colors.error}`
          }}>
            {error}
          </div>
        )}

        {/* Save Guest Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: loading ? colors.textMuted : colors.success,
            color: '#FFFFFF',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%'
          }}
        >
          {loading ? 'Saving Guest...' : 'Save Guest'}
        </button>
      </form>
    </div>
  );
};

export default AddGuest;
