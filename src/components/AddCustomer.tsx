import React, { useEffect, useState } from 'react';
import { addCustomer, getUnits, type NewCustomer, type Unit } from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface AddCustomerProps {
  onBack: () => void;
  onCustomerAdded: () => void;
  refreshTrigger?: number; // Optional prop to trigger room list refresh
}

const AddCustomer: React.FC<AddCustomerProps> = ({ onBack, onCustomerAdded, refreshTrigger }) => {
  const { colors } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    room_id: 0,
    check_in: '',
    check_out: '',
    daily_rate: 0
  });
  
  const [rooms, setRooms] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);  // New state for walk-in toggle

  // Load available rooms on component mount and when refresh is triggered
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const allRooms = await getUnits();
        // Filter only available rooms (not occupied)
        const availableRooms = allRooms.filter(room => !room.is_occupied);
        setRooms(availableRooms);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Failed to load rooms:', err);
        const errorMessage = 'Failed to load available rooms';
        setError(errorMessage);
        showError('Error loading rooms', errorMessage);
      }
    };

    loadRooms();
  }, [refreshTrigger, showError]); // Add showError as dependency

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
        throw new Error(`${label.client} name is required`);
      }
      if (!isWalkIn && formData.room_id === 0) {
        throw new Error(`Please select a ${label.unit.toLowerCase()} or choose walk-in ${label.client.toLowerCase()}`);
      }
      if (!formData.check_in) {
        throw new Error(`${label.action} date is required`);
      }
      if (!isWalkIn && !formData.check_out) {
        throw new Error(`${label.actionOut} date is required for ${label.unit.toLowerCase()} ${label.client.toLowerCase()}s`);
      }
      if (!isWalkIn && formData.check_in && formData.check_out) {
        const checkIn = new Date(formData.check_in);
        const checkOut = new Date(formData.check_out);
        if (checkOut <= checkIn) {
          throw new Error(`${label.actionOut} date must be after ${label.action.toLowerCase()} date`);
        }
      }

      const newCustomer: NewCustomer = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        room_id: isWalkIn ? undefined : formData.room_id,  // Don't assign room for walk-in
        check_in: formData.check_in,
        check_out: formData.check_out || undefined,
        daily_rate: formData.daily_rate
      };

      const customerId = await addCustomer(newCustomer);
      console.log(`✅ ${label.client} added successfully:`, customerId);
      
      // Show success notification
      const guestType = isWalkIn
        ? `Walk-in ${label.client.toLowerCase()}`
        : `${label.unit} ${label.client.toLowerCase()}`;
      showSuccess(
        `${guestType} added successfully!`,
        `${formData.name} has been registered${!isWalkIn ? ` in ${label.unit.toLowerCase()} ${rooms.find(r => r.id === formData.room_id)?.number}` : ''}`
      );
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        room_id: 0,
        check_in: '',
        check_out: '',
        daily_rate: 0
      });
      setIsWalkIn(false);

      onCustomerAdded();
      onBack();
    } catch (err) {
      console.error(`❌ Failed to add ${label.client.toLowerCase()}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Failed to add ${label.client.toLowerCase()}`;
      setError(errorMessage);
      showError(`Failed to add ${label.client.toLowerCase()}`, errorMessage);
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
          background: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Add New {label.client}
        </h1>
      </div>

      {/* Walk-in Customer Toggle */}
      <div style={{ 
        marginBottom: '2rem',
        backgroundColor: colors.surface,
        padding: '1rem',
        borderRadius: '8px',
        border: `1px solid ${colors.border}`
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          cursor: 'pointer',
          fontWeight: '500',
          color: colors.text
        }}>
          <input
            type="checkbox"
            checked={isWalkIn}
            onChange={(e) => {
              setIsWalkIn(e.target.checked);
              if (e.target.checked) {
                // Reset room selection for walk-in customers
                setFormData(prev => ({ ...prev, room_id: 0, check_out: '' }));
              }
            }}
            style={{ 
              marginRight: '0.5rem',
              transform: 'scale(1.2)'
            }}
          />
          <span>Walk-in {label.client} (No {label.unit.toLowerCase()} assignment)</span>
        </label>
        {isWalkIn && (
          <p style={{ 
            margin: '0.5rem 0 0 1.7rem',
            color: colors.textMuted,
            fontSize: '0.875rem'
          }}>
            Walk-in {label.client.toLowerCase()}s can place orders without a {label.unit.toLowerCase()}.
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        {/* Name */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            {label.client} name (required)
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
            placeholder={`Enter ${label.client.toLowerCase()} name`}
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

        {/* Unit Number - Only for non-walk-in customers */}
        {!isWalkIn && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: colors.text
            }}>
              {label.unit} Number (required)
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
              <option value={0}>Select a {label.unit.toLowerCase()}</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {label.unit} {room.number} - {formatMoney(room.daily_rate)}/day
                </option>
              ))}
            </select>
            {rooms.length === 0 && (
              <p style={{ color: colors.error, fontSize: '0.875rem', marginTop: '0.5rem' }}>
                No available {label.unit.toLowerCase()}s found
              </p>
            )}
          </div>
        )}

        {/* Action Date */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            {label.action} Date
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

        {/* Action Out Date - Optional for walk-in customers */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            {label.actionOut} Date {!isWalkIn && '(required)'}
            {isWalkIn && (
              <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>
                {' '}(optional for walk-in customers)
              </span>
            )}
          </label>
          <input
            type="date"
            name="check_out"
            value={formData.check_out}
            onChange={handleInputChange}
            required={!isWalkIn}
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

        {/* Daily Rate */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500',
            color: colors.text
          }}>
            {isWalkIn ? 'Daily Service Rate (optional)' : `Daily ${label.unit} Rate`}
          </label>
          <input
            type="number"
            name="daily_rate"
            value={formData.daily_rate}
            onChange={handleInputChange}
            min="0"
            step="0.01"
            readOnly={!isWalkIn && formData.room_id > 0}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: (!isWalkIn && formData.room_id > 0) ? colors.secondary : colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '1rem',
              cursor: (!isWalkIn && formData.room_id > 0) ? 'not-allowed' : 'text'
            }}
            placeholder={isWalkIn ? "Enter daily service rate (optional)" : `Rate will be auto-filled when ${label.unit.toLowerCase()} is selected`}
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
                Total estimated cost: <strong>{formatMoney(stayDays * formData.daily_rate)}</strong>
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

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: loading ? colors.textMuted : colors.success,
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%'
          }}
        >
          {loading ? `Saving ${label.client}...` : `Save ${label.client}`}
        </button>
      </form>
    </div>
  );
};

export default AddCustomer;
