import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type ExpenseRecord,
    type ExportFilters,
    type FoodOrderSummary,
    type Guest,
    type Room,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface HistoryProps {
  onBack: () => void;
}

type Tab = 'guests' | 'orders' | 'expenses';

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Invalid Date';
  return parsed.toLocaleDateString();
};

const History: React.FC<HistoryProps> = ({ onBack }) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const [tab, setTab] = useState<Tab>('guests');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [orders, setOrders] = useState<FoodOrderSummary[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room.number])), [rooms]);

  const load = async () => {
    setLoading(true);
    try {
      const [roomRows, guestRows] = await Promise.all([
        hotelRestaurantService.getRooms(),
        hotelRestaurantService.getAllGuests() as Promise<Guest[]>,
      ]);
      setRooms(roomRows);
      setGuests(guestRows);

      if (tab === 'orders') {
        setOrders(await hotelRestaurantService.getFoodOrders());
      }
      if (tab === 'expenses') {
        if (startDate && endDate) {
          setExpenses(await hotelRestaurantService.getExpensesByDateRange(startDate, endDate));
        } else {
          setExpenses(await hotelRestaurantService.getExpenses());
        }
      }
    } catch (error) {
      showError('Failed to load history', String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const exportData = async () => {
    try {
      const filters: ExportFilters = {};
      if (startDate) filters.date_from = startDate;
      if (endDate) filters.date_to = endDate;
      const mappedTab = tab === 'orders' ? 'orders' : tab;
      const filePath = await hotelRestaurantService.exportHistoryCsvWithDialog(mappedTab, filters);
      showSuccess('Export complete', filePath);
    } catch (error) {
      const message = String(error);
      if (message.toLowerCase().includes('cancelled')) return;
      showError('Export failed', message);
    }
  };

  const guestsFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((guest) => {
      return (
        guest.name.toLowerCase().includes(term) ||
        (guest.phone ?? '').toLowerCase().includes(term) ||
        String(guest.room_id ?? '').includes(term)
      );
    });
  }, [guests, search]);

  const ordersFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      return (
        String(order.id).includes(term) ||
        (order.guest_name ?? '').toLowerCase().includes(term) ||
        (order.items ?? '').toLowerCase().includes(term)
      );
    });
  }, [orders, search]);

  const expensesFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((expense) => {
      return (
        expense.category.toLowerCase().includes(term) ||
        expense.description.toLowerCase().includes(term)
      );
    });
  }, [expenses, search]);

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>History</h2>

      <div className="bc-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className="bc-btn bc-btn-outline" onClick={() => setTab('guests')}>Guests</button>
          <button className="bc-btn bc-btn-outline" onClick={() => setTab('orders')}>Food Orders</button>
          <button className="bc-btn bc-btn-outline" onClick={() => setTab('expenses')}>Expenses</button>
          <button className="bc-btn bc-btn-primary" onClick={exportData}>Export</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px 170px auto auto', gap: 8 }}>
          <input className="bc-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          <input className="bc-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="bc-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="bc-btn bc-btn-outline" onClick={load}>Apply</button>
          <button
            className="bc-btn bc-btn-outline"
            onClick={() => {
              setSearch('');
              setStartDate('');
              setEndDate('');
              load();
              showWarning('Filters cleared');
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bc-card" style={{ padding: 12 }}>Loading...</div>
      ) : (
        <div className="bc-card" style={{ padding: 12 }}>
          {tab === 'guests' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">Phone</th>
                  <th align="left">Room</th>
                  <th align="left">Check-in</th>
                  <th align="left">Check-out</th>
                  <th align="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {guestsFiltered.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.name}</td>
                    <td>{guest.phone ?? 'N/A'}</td>
                    <td>{guest.room_id ? roomById.get(guest.room_id) ?? `#${guest.room_id}` : 'Walk-in'}</td>
                    <td>{formatDate(guest.check_in)}</td>
                    <td>{formatDate(guest.check_out)}</td>
                    <td>{guest.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'orders' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Order</th>
                  <th align="left">Guest</th>
                  <th align="left">Date</th>
                  <th align="left">Total</th>
                  <th align="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordersFiltered.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.guest_name ?? 'Walk-in'}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.total_amount.toFixed(2)}</td>
                    <td>{order.paid ? 'Paid' : 'Unpaid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'expenses' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Date</th>
                  <th align="left">Category</th>
                  <th align="left">Description</th>
                  <th align="left">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expensesFiltered.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.date)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description}</td>
                    <td>{expense.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default History;
