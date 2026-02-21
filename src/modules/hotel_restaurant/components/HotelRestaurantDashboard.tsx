import React, { useEffect, useMemo, useState } from 'react';
import type { ActiveGuestRow } from '../../../api/modules/hotelRestaurantService';
import { hotelRestaurantService } from '../../../api/modules/hotelRestaurantService';
import Settings from '../../../components/SettingsNew';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { useTheme } from '../../../context/ThemeContext';
import ActiveGuests from './ActiveGuests';
import AddExpense from './AddExpense';
import AddFoodOrder from './AddFoodOrder';
import AddGuest from './AddGuest';
import CheckoutScreen from './CheckoutScreen';
import History from './History';
import ManageMenuRooms from './ManageMenuRooms';
import MonthlyReport from './MonthlyReport';

type Page =
  | 'dashboard'
  | 'add-guest'
  | 'active-guests'
  | 'add-order'
  | 'add-expense'
  | 'monthly-report'
  | 'history'
  | 'checkout'
  | 'manage'
  | 'settings';

interface DashboardStats {
  total_guests_this_month: number;
  total_income: number;
  total_expenses: number;
  profit_loss: number;
  total_food_orders: number;
  active_guests: number;
}

const HotelRestaurantDashboard: React.FC = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const [page, setPage] = useState<Page>('dashboard');
  const [refreshTick, setRefreshTick] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [checkoutGuest, setCheckoutGuest] = useState<ActiveGuestRow | null>(null);

  useEffect(() => {
    hotelRestaurantService
      .getDashboardStats()
      .then((result) => setStats(result as DashboardStats))
      .catch(() => setStats(null));
  }, [refreshTick]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Guests This Month', value: String(stats.total_guests_this_month) },
      { label: 'Active Guests', value: String(stats.active_guests) },
      { label: 'Food Orders', value: String(stats.total_food_orders) },
      { label: 'Income', value: formatMoney(stats.total_income) },
      { label: 'Expenses', value: formatMoney(stats.total_expenses) },
      { label: 'Profit/Loss', value: formatMoney(stats.profit_loss) },
    ];
  }, [stats, formatMoney]);

  if (page === 'add-guest') {
    return <AddGuest onBack={() => setPage('dashboard')} onChanged={() => setRefreshTick((x) => x + 1)} />;
  }
  if (page === 'add-order') {
    return <AddFoodOrder onBack={() => setPage('dashboard')} onChanged={() => setRefreshTick((x) => x + 1)} />;
  }
  if (page === 'add-expense') {
    return <AddExpense onBack={() => setPage('dashboard')} onChanged={() => setRefreshTick((x) => x + 1)} />;
  }
  if (page === 'active-guests') {
    return (
      <ActiveGuests
        onBack={() => setPage('dashboard')}
        onChanged={() => setRefreshTick((x) => x + 1)}
        onCheckoutGuest={(guest) => {
          setCheckoutGuest(guest);
          setPage('checkout');
        }}
      />
    );
  }
  if (page === 'monthly-report') {
    return <MonthlyReport onBack={() => setPage('dashboard')} />;
  }
  if (page === 'history') {
    return <History onBack={() => setPage('dashboard')} />;
  }
  if (page === 'checkout' && checkoutGuest) {
    return (
      <CheckoutScreen
        guest={checkoutGuest}
        onBack={() => setPage('active-guests')}
        onCheckoutComplete={() => {
          setCheckoutGuest(null);
          setPage('dashboard');
          setRefreshTick((x) => x + 1);
        }}
      />
    );
  }
  if (page === 'manage') {
    return <ManageMenuRooms onBack={() => setPage('dashboard')} onChanged={() => setRefreshTick((x) => x + 1)} />;
  }
  if (page === 'settings') {
    return (
      <div style={{ padding: 20 }}>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('dashboard')}>← Back</button>
        <div style={{ marginTop: 12 }}>
          <Settings initialTab="general" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, color: colors.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Hotel / Restaurant Dashboard</h1>
        <button className="bc-btn bc-btn-outline" onClick={logout}>Logout</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="bc-btn bc-btn-primary" onClick={() => setPage('add-guest')}>Add Guest</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('active-guests')}>Active Guests</button>
        <button className="bc-btn bc-btn-primary" onClick={() => setPage('add-order')}>Add Food Order</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('add-expense')}>Add Expense</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('monthly-report')}>Monthly Report</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('history')}>History</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('manage')}>Manage Menu / Rooms</button>
        <button className="bc-btn bc-btn-outline" onClick={() => setPage('settings')}>Settings</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {cards.length === 0 ? (
          <div className="bc-card" style={{ padding: 16 }}>Loading dashboard stats...</div>
        ) : (
          cards.map((card) => (
            <div key={card.label} className="bc-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{card.value}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HotelRestaurantDashboard;
