import React, { useCallback, useEffect, useState } from 'react';
import type { ActiveCustomerRow, SaleSummary, Unit } from '../api/client';
import {
    deleteSale,
    getActiveCustomers,
    getAvailableUnitsForCustomer,
    getSalesByCustomer,
    printOrderReceipt,
    toggleSalePayment,
    updateCustomer
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useTheme } from '../context/ThemeContext';
import Checkout from './Checkout';

interface ActiveCustomersProps {
  onBack: () => void;
  onAddSale: (guestId: number) => void;
}

interface ActiveGuestWithOrders extends ActiveCustomerRow {
  totalFoodOrders: number;
  stayDays: number;
  foodOrders?: SaleSummary[];
  totalAmountDue: number;
  roomCharges: number;
  unpaidFoodTotal: number;
}

const ActiveCustomers: React.FC<ActiveCustomersProps> = ({ onBack, onAddSale }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  const [guests, setGuests] = useState<ActiveGuestWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGuest, setEditingGuest] = useState<ActiveCustomerRow | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [expandedGuest, setExpandedGuest] = useState<number | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Unit[]>([]);
  
  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedGuestForCheckout, setSelectedGuestForCheckout] = useState<ActiveCustomerRow | null>(null);
  
  // User feedback states
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Edit form states
  const [editName, setEditName] = useState('');
  const [editCheckinDate, setEditCheckinDate] = useState('');
  const [editCheckoutDate, setEditCheckoutDate] = useState('');
  const [editRoomId, setEditRoomId] = useState<number>(0);
  const [editDailyRate, setEditDailyRate] = useState('');

  // Separate guests by type
  const roomGuests = guests.filter(guest => !guest.is_walkin);
  const walkinGuests = guests.filter(guest => guest.is_walkin);

  // Auto-clear success/error messages after 3 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  const calculateGuestTotals = useCallback((guest: ActiveCustomerRow, foodOrders: SaleSummary[]) => {
    // Calculate stay days: if checkout date exists, use it; otherwise use today's date
    const endDate = guest.check_out ? new Date(guest.check_out) : new Date();
    const startDate = new Date(guest.check_in);
    const stayDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    const roomCharges = guest.daily_rate * stayDays;

    // Calculate unpaid food orders total
    const unpaidFoodTotal = foodOrders
      .filter(order => !order.paid)
      .reduce((sum, order) => sum + order.total_amount, 0);

    const totalAmountDue = roomCharges + unpaidFoodTotal;

    return {
      stayDays,
      roomCharges,
      unpaidFoodTotal,
      totalAmountDue
    };
  }, []);

  const loadActiveGuests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getActiveCustomers();

      // Transform response to include required properties and load food orders
      const guestsWithOrders: ActiveGuestWithOrders[] = await Promise.all(
        response.map(async (guest: ActiveCustomerRow) => {
          try {
            // Load food orders for each guest
            const foodOrders = await getSalesByCustomer(guest.guest_id);
            const totals = calculateGuestTotals(guest, foodOrders);

            return {
              ...guest,
              totalFoodOrders: foodOrders.length,
              foodOrders: foodOrders,
              ...totals
            };
          } catch (error) {
            console.error(`Error loading orders for guest ${guest.guest_id}:`, error);
            const totals = calculateGuestTotals(guest, []);
            return {
              ...guest,
              totalFoodOrders: 0,
              foodOrders: [],
              ...totals
            };
          }
        })
      );

      setGuests(guestsWithOrders);
    } catch (error) {
      console.error('Error loading active guests:', error);
      setError(`Failed to load active ${label.client.toLowerCase()}s`);
    } finally {
      setLoading(false);
    }
  }, [calculateGuestTotals, label.client]);

  useEffect(() => {
    loadActiveGuests();
  }, [loadActiveGuests]);

  const loadAvailableRoomsForEdit = async (guestId?: number) => {
    setIsLoadingRooms(true);
    try {
      const rooms = await getAvailableUnitsForCustomer(guestId);
      setAvailableRooms(rooms);
    } catch (error) {
      console.error("Error loading available rooms:", error);
      setError(`Failed to load available ${label.unit.toLowerCase()}s`);
    } finally {
      setIsLoadingRooms(false);
    }
  };



  const handleEditGuest = async (guest: ActiveCustomerRow) => {
    setEditingGuest(guest);
    setEditName(guest.name);
    setEditCheckinDate(guest.check_in);
    setEditCheckoutDate(guest.check_out || ''); // Set existing checkout date or empty if none
    setEditRoomId(0); // Will be set after rooms load
    setEditDailyRate(guest.daily_rate.toString());
    setError(null);
    setSuccessMessage(null);
    
    // Load available rooms for this guest (includes their current room)
    await loadAvailableRoomsForEdit(guest.guest_id);
    
    // Find and set the current room ID after rooms are loaded
    setTimeout(() => {
      const currentRoom = availableRooms.find(room => room.number === guest.room_number);
      if (currentRoom) {
        setEditRoomId(currentRoom.id);
      }
    }, 100); // Small delay to ensure rooms are loaded
    
    setShowEditForm(true);
  };

  const handleUpdateGuest = async () => {
    if (!editingGuest || !editName || !editCheckinDate || !editDailyRate || !editRoomId) {
      setError('Please fill in all required fields');
      return;
    }

    setIsUpdating(true);
    setError(null);
    
    try {
      const updates = {
        name: editName,
        room_id: editRoomId,
        check_in: editCheckinDate,
        check_out: editCheckoutDate.trim() === '' ? undefined : editCheckoutDate,
        daily_rate: parseFloat(editDailyRate)
      };

      await updateCustomer(editingGuest.guest_id, updates);
      setSuccessMessage(`${label.client} ${editName} updated successfully!`);
      setShowEditForm(false);
      setEditingGuest(null);
      loadActiveGuests();
    } catch (err) {
      setError(`Failed to update ${label.client.toLowerCase()}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCheckoutGuest = (guest: ActiveCustomerRow) => {
    setSelectedGuestForCheckout(guest);
    setShowCheckout(true);
  };

  const resetEditForm = () => {
    setEditingGuest(null);
    setEditName('');
    setEditCheckinDate('');
    setEditCheckoutDate('');
    setEditRoomId(0);
    setEditDailyRate('');
    setShowEditForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleTogglePayment = async (orderId: number) => {
    setError(null);
    try {
      const result = await toggleSalePayment(orderId);
      setSuccessMessage('Payment status updated successfully!');
      console.log('Payment toggle result:', result);
      // Reload the guests to update the payment status
      await loadActiveGuests();
    } catch (err) {
      setError(`Failed to toggle payment status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Toggle payment error:', err);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      setError(null);
      try {
        await deleteSale(orderId);
        setSuccessMessage('Order deleted successfully!');
        // Reload the guests to update the orders list
        loadActiveGuests();
      } catch (err) {
        setError(`Failed to delete order: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error(err);
      }
    }
  };

  const formatCurrency = (amount: number) => formatMoney(amount);

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
            color: 'white',
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
          Active {label.client}s
        </h1>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          backgroundColor: colors.successBg,
          color: colors.success,
          border: `1px solid ${colors.success}`,
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

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
          gridTemplateColumns: '180px 100px 160px 80px 120px 120px 250px',
          backgroundColor: colors.secondary,
          padding: '1rem',
          fontWeight: '600',
          borderBottom: `1px solid ${colors.border}`,
          gap: '1rem'
        }}>
          <div>{label.client} Name</div>
          <div>{label.unit} No.</div>
          <div>{label.action} / {label.actionOut}</div>
          <div>Stay Days</div>
          <div>Sales</div>
          <div>Total Amount Due</div>
          <div>Actions</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Loading active {label.client.toLowerCase()}s...
          </div>
        ) : guests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>
            No active {label.client.toLowerCase()}s found
          </div>
        ) : (
          <>
            {/* Room Guests Section */}
            {roomGuests.length > 0 && (
              <>
                <div style={{
                  backgroundColor: colors.secondary,
                  padding: '0.75rem 1rem',
                  fontWeight: '600',
                  fontSize: '1.1rem',
                  color: colors.accent,
                  borderBottom: `2px solid ${colors.accent}`
                }}>
                  {label.unit} {label.client}s ({roomGuests.length})
                </div>
                {roomGuests.map((guest) => (
                  <React.Fragment key={guest.guest_id}>
                    {/* Main Guest Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 100px 160px 80px 120px 120px 250px',
                        backgroundColor: colors.surface,
                        padding: '1rem',
                        borderBottom: `1px solid ${colors.border}`,
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{guest.name}</div>
                      <div>{label.unit} {guest.room_number}</div>
                      <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                        <div>{formatDate(guest.check_in)}</div>
                        <div>{guest.check_out ? formatDate(guest.check_out) : 'Open'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>{guest.stayDays}</div>
                      <div style={{ textAlign: 'center' }}>
                        {formatCurrency(guest.unpaidFoodTotal)}
                        {guest.totalFoodOrders > 0 && (
                          <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                            {guest.totalFoodOrders} orders
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: '600', color: colors.accent }}>
                        {formatCurrency(guest.totalAmountDue)}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleEditGuest(guest)}
                          style={{
                            backgroundColor: colors.warning,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onAddSale(guest.guest_id)}
                          style={{
                            backgroundColor: colors.accent,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Add Order
                        </button>
                        <button
                          onClick={() => setExpandedGuest(expandedGuest === guest.guest_id ? null : guest.guest_id)}
                          style={{
                            backgroundColor: colors.accent,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          {expandedGuest === guest.guest_id ? 'Hide' : 'Orders'}
                        </button>
                        <button
                          onClick={() => handleCheckoutGuest(guest)}
                          style={{
                            backgroundColor: colors.success,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Checkout
                        </button>
                      </div>
                    </div>

                    {/* Expanded Food Orders */}
                    {expandedGuest === guest.guest_id && guest.foodOrders && (
                      <div style={{
                        backgroundColor: colors.secondary,
                        padding: '1rem',
                        borderBottom: `1px solid ${colors.border}`
                      }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: colors.accent }}>
                          Sales for {guest.name}
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
                                  <span style={{ fontWeight: '500' }}>Order #{order.id}</span>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    backgroundColor: order.paid ? colors.success : colors.warning,
                                    color: 'white'
                                  }}>
                                    {order.paid ? 'PAID' : 'UNPAID'}
                                  </span>
                                </div>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: colors.textMuted }}>
                                  {formatDateTime(order.created_at)} • Total: {formatCurrency(order.total_amount)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleTogglePayment(order.id)}
                                  style={{
                                    backgroundColor: order.paid ? colors.warning : colors.success,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
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
                                    backgroundColor: colors.error,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => printOrderReceipt(order.id)}
                                  style={{
                                    backgroundColor: colors.accent,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Print
                                </button>
                              </div>
                            </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '2rem' }}>
                            No sales found for this {label.client.toLowerCase()}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}

            {/* Walk-in Customers Section */}
            {walkinGuests.length > 0 && (
              <>
                <div style={{
                  backgroundColor: colors.secondary,
                  padding: '0.75rem 1rem',
                  fontWeight: '600',
                  fontSize: '1.1rem',
                  color: colors.accent,
                  borderBottom: `2px solid ${colors.accent}`,
                  marginTop: roomGuests.length > 0 ? '2rem' : '0'
                }}>
                  🚶 Walk-in {label.client}s ({walkinGuests.length})
                </div>
                {walkinGuests.map((guest) => (
                  <React.Fragment key={guest.guest_id}>
                    {/* Main Guest Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 100px 160px 80px 120px 120px 250px',
                        backgroundColor: colors.surface,
                        padding: '1rem',
                        borderBottom: `1px solid ${colors.border}`,
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{guest.name}</div>
                      <div>
                        <span style={{ 
                          color: colors.accent, 
                          fontWeight: '500',
                          fontSize: '0.875rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: `${colors.accent}20`,
                          borderRadius: '4px'
                        }}>
                          Walk-in
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                        <div>{formatDate(guest.check_in)}</div>
                        <div>{guest.check_out ? formatDate(guest.check_out) : 'Open'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>{guest.stayDays || '—'}</div>
                      <div style={{ textAlign: 'center' }}>
                        {formatCurrency(guest.unpaidFoodTotal)}
                        {guest.totalFoodOrders > 0 && (
                          <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                            {guest.totalFoodOrders} orders
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: '600', color: colors.accent }}>
                        {formatCurrency(guest.totalAmountDue)}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleEditGuest(guest)}
                          style={{
                            backgroundColor: colors.warning,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onAddSale(guest.guest_id)}
                          style={{
                            backgroundColor: colors.accent,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Add Order
                        </button>
                        <button
                          onClick={() => setExpandedGuest(expandedGuest === guest.guest_id ? null : guest.guest_id)}
                          style={{
                            backgroundColor: colors.accent,
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          {expandedGuest === guest.guest_id ? 'Hide' : 'Orders'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Food Orders */}
                    {expandedGuest === guest.guest_id && guest.foodOrders && (
                      <div style={{
                        backgroundColor: colors.secondary,
                        padding: '1rem',
                        borderBottom: `1px solid ${colors.border}`
                      }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: colors.accent }}>
                          Sales for {guest.name} (Walk-in {label.client})
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
                                  <span style={{ fontWeight: '500' }}>Order #{order.id}</span>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    backgroundColor: order.paid ? colors.success : colors.warning,
                                    color: 'white'
                                  }}>
                                    {order.paid ? 'PAID' : 'UNPAID'}
                                  </span>
                                </div>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: colors.textMuted }}>
                                  {formatDateTime(order.created_at)} • Total: {formatCurrency(order.total_amount)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleTogglePayment(order.id)}
                                  style={{
                                    backgroundColor: order.paid ? colors.warning : colors.success,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
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
                                    backgroundColor: colors.error,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => printOrderReceipt(order.id)}
                                  style={{
                                    backgroundColor: colors.accent,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Print
                                </button>
                              </div>
                            </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '2rem' }}>
                            No sales found for this {label.client.toLowerCase()}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}
          </>
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
              Edit {label.client}: {editingGuest.name}
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                {label.client} Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '1rem'
                }}
                placeholder={`${label.client.toLowerCase()} name`}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                {label.action} Date
              </label>
              <input
                type="date"
                value={editCheckinDate}
                onChange={(e) => setEditCheckinDate(e.target.value)}
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
                {label.actionOut} Date
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
                {label.unit}
              </label>
              <select
                value={editRoomId}
                onChange={(e) => setEditRoomId(Number(e.target.value))}
                disabled={isLoadingRooms}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '1rem',
                  opacity: isLoadingRooms ? 0.6 : 1
                }}
              >
                <option value="">
                  {isLoadingRooms ? `Loading available ${label.unit.toLowerCase()}s...` : `Select a ${label.unit.toLowerCase()}`}
                </option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {label.unit} {room.number} - {room.room_type} ({formatMoney(room.daily_rate)}/day)
                    {room.is_occupied && room.guest_id === editingGuest?.guest_id ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
              {availableRooms.length === 0 && !isLoadingRooms && (
                <div style={{ 
                  color: colors.error, 
                  fontSize: '0.875rem', 
                  marginTop: '0.5rem' 
                }}>
                  No available {label.unit.toLowerCase()}s found. All {label.unit.toLowerCase()}s are currently occupied.
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Daily Rate
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
                  color: 'white',
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
                disabled={isUpdating || isLoadingRooms}
                style={{
                  backgroundColor: isUpdating ? colors.textMuted : colors.success,
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: isUpdating || isLoadingRooms ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  opacity: isUpdating || isLoadingRooms ? 0.6 : 1
                }}
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && selectedGuestForCheckout && (
        <Checkout
          guest={selectedGuestForCheckout}
          onBack={() => {
            setShowCheckout(false);
            setSelectedGuestForCheckout(null);
          }}
          onClose={() => {
            setShowCheckout(false);
            setSelectedGuestForCheckout(null);
          }}
          onCheckoutComplete={() => {
            setShowCheckout(false);
            setSelectedGuestForCheckout(null);
            loadActiveGuests(); // Refresh the guests list
          }}
        />
      )}
    </div>
  );
};

export default ActiveCustomers;
