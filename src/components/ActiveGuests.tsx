import React, { useEffect, useState } from 'react';
import type { ActiveGuestRow, FoodOrderSummary } from '../api/client';
import {
    checkoutGuest,
    deleteFoodOrder,
    getActiveGuests,
    getFoodOrdersByGuest,
    printOrderReceipt,
    toggleFoodOrderPayment
} from '../api/client';
import { useTheme } from '../context/ThemeContext';

interface ActiveGuestsProps {
  onBack: () => void;
  onAddOrder: (guestId: number) => void;
}

interface ActiveGuestWithOrders extends ActiveGuestRow {
  totalFoodOrders: number;
  stayDays: number;
  foodOrders?: FoodOrderSummary[];
}

const ActiveGuests: React.FC<ActiveGuestsProps> = ({ onBack, onAddOrder }) => {
  const { colors } = useTheme();
  const [guests, setGuests] = useState<ActiveGuestWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGuest, setEditingGuest] = useState<ActiveGuestRow | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [expandedGuest, setExpandedGuest] = useState<number | null>(null);
  
  // Edit form states
  const [editCheckoutDate, setEditCheckoutDate] = useState('');
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('');

  useEffect(() => {
    loadActiveGuests();
  }, []);

  const loadActiveGuests = async () => {
    try {
      setLoading(true);
      const response = await getActiveGuests();
      
      // Transform response to include required properties and load food orders
      const guestsWithOrders: ActiveGuestWithOrders[] = await Promise.all(
        response.map(async (guest: ActiveGuestRow) => {
          try {
            // Load food orders for each guest
            const foodOrders = await getFoodOrdersByGuest(guest.guest_id);
            return {
              ...guest,
              totalFoodOrders: foodOrders.length,
              stayDays: Math.ceil((new Date().getTime() - new Date(guest.check_in).getTime()) / (1000 * 3600 * 24)),
              foodOrders: foodOrders
            };
          } catch (error) {
            console.error(`Error loading orders for guest ${guest.guest_id}:`, error);
            return {
              ...guest,
              totalFoodOrders: 0,
              stayDays: Math.ceil((new Date().getTime() - new Date(guest.check_in).getTime()) / (1000 * 3600 * 24)),
              foodOrders: []
            };
          }
        })
      );
      
      setGuests(guestsWithOrders);
    } catch (error) {
      console.error("Error loading active guests:", error);
      setError("Failed to load active guests");
    } finally {
      setLoading(false);
    }
  };

  const handleEditGuest = (_guest: ActiveGuestRow) => {
    // For now, disable editing until we have full guest details
    setError('Edit functionality will be implemented in next update');
    return;
    
    // setEditingGuest(guest);
    // setEditCheckoutDate(''); 
    // setEditRoomNumber(guest.room_number);
    // setEditDailyRate(guest.daily_rate.toString());
    // setShowEditForm(true);
  };

  const handleUpdateGuest = async () => {
    // Disabled for now
    setError('Edit functionality will be implemented in next update');
    return;
    
    // if (!editingGuest || !editCheckoutDate || !editRoomNumber || !editDailyRate) {
    //   setError('Please fill in all fields');
    //   return;
    // }

    // try {
    //   await updateGuest(editingGuest.id, {
    //     name: editingGuest.name,
    //     phone: editingGuest.phone,
    //     room_id: parseInt(editRoomNumber),
    //     check_in: editingGuest.check_in,
    //     check_out: editCheckoutDate,
    //     daily_rate: parseFloat(editDailyRate)
    //   });

    //   setShowEditForm(false);
    //   setEditingGuest(null);
    //   loadActiveGuests();
    // } catch (err) {
    //   setError('Failed to update guest');
    //   console.error(err);
    // }
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

  const handleToggleGuestOrders = (guestId: number) => {
    setExpandedGuest(expandedGuest === guestId ? null : guestId);
  };

  const handlePrintReceipt = async (orderId: number) => {
    try {
      setError(null); // Clear any previous errors
      await printOrderReceipt(orderId);
      // Receipt will be printed automatically
      console.log(`Receipt printed for order ${orderId}`);
    } catch (err) {
      setError('Failed to print receipt');
      console.error('Print error:', err);
    }
  };

  const handleTogglePayment = async (orderId: number) => {
    try {
      setError(null); // Clear any previous errors
      const result = await toggleFoodOrderPayment(orderId);
      console.log('Payment toggle result:', result);
      // Reload the guests to update the payment status
      await loadActiveGuests();
    } catch (err) {
      setError('Failed to toggle payment status');
      console.error('Toggle payment error:', err);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (confirm('Are you sure you want to delete this food order? This action cannot be undone.')) {
      try {
        await deleteFoodOrder(orderId);
        // Reload the guests to update the orders list
        loadActiveGuests();
      } catch (err) {
        setError('Failed to delete order');
        console.error(err);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
          gridTemplateColumns: '200px 100px 180px 80px 120px 250px',
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
          <div>Food Orders</div>
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
          guests.map((guest) => (
            <React.Fragment key={guest.guest_id}>
              {/* Main Guest Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 100px 180px 80px 120px 250px',
                  padding: '1rem',
                  borderBottom: `1px solid ${colors.border}`,
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ fontWeight: '500' }}>{guest.name}</div>
                <div>Room {guest.room_number}</div>
                <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                  <div>{formatDate(guest.check_in)}</div>
                  <div>Open</div>
                </div>
                <div style={{ textAlign: 'center' }}>{guest.stayDays}</div>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => handleToggleGuestOrders(guest.guest_id)}
                    style={{
                      backgroundColor: guest.totalFoodOrders > 0 ? colors.accent : colors.textMuted,
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {guest.totalFoodOrders} Orders
                    {guest.totalFoodOrders > 0 && (
                      <span style={{ fontSize: '0.75rem' }}>
                        {expandedGuest === guest.guest_id ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                </div>
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
                    onClick={() => onAddOrder(guest.guest_id)}
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
                    onClick={() => handleCheckoutGuest(guest.guest_id, guest.name)}
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

              {/* Expanded Food Orders */}
              {expandedGuest === guest.guest_id && (
                <div style={{
                  backgroundColor: colors.secondary,
                  padding: '1rem',
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: colors.accent }}>
                    Food Orders for {guest.name}
                  </h4>
                  {guest.foodOrders && guest.foodOrders.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {guest.foodOrders.map((order) => (
                      <div
                        key={order.id}
                        style={{
                          backgroundColor: colors.surface,
                          padding: '1rem',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ fontWeight: '500' }}>
                              Order #{order.id}
                            </div>
                            <div style={{ 
                              fontSize: '0.875rem', 
                              color: colors.textSecondary 
                            }}>
                              {formatDateTime(order.created_at)}
                            </div>
                            <div style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: order.paid ? '#22C55E' : '#F59E0B',
                              color: '#FFFFFF'
                            }}>
                              {order.paid ? 'PAID' : 'UNPAID'}
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '0.875rem', 
                            color: colors.textSecondary,
                            marginTop: '0.25rem'
                          }}>
                            Items: {order.items || 'No items listed'}
                          </div>
                          <div style={{ 
                            fontWeight: '500',
                            color: colors.accent,
                            marginTop: '0.25rem'
                          }}>
                            Total: {formatCurrency(order.total_amount)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handlePrintReceipt(order.id)}
                            style={{
                              backgroundColor: '#3B82F6',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Print
                          </button>
                          <button
                            onClick={() => handleTogglePayment(order.id)}
                            style={{
                              backgroundColor: order.paid ? '#EF4444' : '#22C55E',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            {order.paid ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            style={{
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: colors.textMuted,
                      fontSize: '0.875rem',
                      padding: '1rem'
                    }}>
                      No food orders found for this guest.
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
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
