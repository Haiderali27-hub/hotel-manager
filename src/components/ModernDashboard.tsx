import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import AddSale from './AddSale';
import FinancialReport from './FinancialReport';
import ProductsPage from './ProductsPage';
import { ProtectedRoute } from './ProtectedRoute';
import Settings from './SettingsNew';

interface SaleSummary {
  id: number;
  created_at: string;
  paid: boolean;
  paid_at: string | null;
  total_amount: number;
  items: string;
  guest_id: number | null;
  guest_name: string | null;
}

interface LowStockItem {
  id: number;
  name: string;
  stock_quantity: number;
  low_stock_limit: number;
}

const ModernDashboard: React.FC = () => {
  const { logout, userRole, adminId } = useAuth();
  const { colors, theme } = useTheme();
  const { formatMoney } = useCurrency();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [businessName, setBusinessName] = useState('Business Manager');
  const [recentSales, setRecentSales] = useState<SaleSummary[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  useEffect(() => {
    loadDashboardData();
    loadBusinessName();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Used for "Recent Activity" and today's revenue/order counts.
      const sales = await invoke<SaleSummary[]>('get_sales');
      setRecentSales(sales);

      const lowStock = await invoke<LowStockItem[]>('get_low_stock_items');
      setLowStockItems(lowStock);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadBusinessName = async () => {
    try {
      const name = await invoke<string>('get_business_name');
      if (name) setBusinessName(name);
    } catch (err) {
      console.error('Failed to load business name:', err);
    }
  };

  const navigationItems: Array<{ id: string; label: string; managerOnly?: boolean; adminOnly?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pos', label: 'POS / Sales' },
    { id: 'products', label: 'Products' },
    { id: 'reports', label: 'Reports', managerOnly: true },
    { id: 'settings', label: 'Settings', adminOnly: true },
  ];

  const filteredNav = navigationItems.filter((item) => {
    if (item.adminOnly) return userRole === 'admin';
    if (item.managerOnly) return userRole === 'admin' || userRole === 'manager';
    return true;
  });

  const isDark = theme === 'dark';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const todaySales = recentSales.filter((s) => {
    const dt = new Date(s.created_at);
    return !Number.isNaN(dt.getTime()) && dt >= startOfToday();
  });

  const grossRevenueToday = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalOrdersToday = todaySales.length;
  const lowStockCount = lowStockItems.length;

  const renderDashboard = () => (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: colors.text }}>
          Dashboard
        </h1>
        <div style={{ marginTop: '4px', fontSize: '14px', color: colors.textSecondary }}>
          Command Center
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        <SpecStatCard title="Gross Revenue" value={formatMoney(grossRevenueToday)} helper="Today" />
        <SpecStatCard title="Total Orders" value={String(totalOrdersToday)} helper="Today" />
        <SpecStatCard title="Low Stock Alerts" value={String(lowStockCount)} helper="Needs attention" />
      </div>

      <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text, marginBottom: '10px' }}>
          Recent Activity
        </div>

        {recentSales.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {recentSales
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 6)
              .map((s) => {
                const dt = new Date(s.created_at);
                const time = Number.isNaN(dt.getTime()) ? s.created_at : dt.toLocaleString();
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      background: 'transparent',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
                        Sale #{s.id}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: colors.textSecondary,
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={s.items}
                      >
                        {s.items || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
                        {formatMoney(s.total_amount || 0)}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>{time}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard();
      case 'pos':
        return <AddSale onBack={() => setCurrentPage('dashboard')} onSaleAdded={loadDashboardData} />;
      case 'products':
        return <ProductsPage onBack={() => setCurrentPage('dashboard')} />;
      case 'reports':
        return (
          <ProtectedRoute requiredRole="manager">
            <FinancialReport onBack={() => setCurrentPage('dashboard')} />
          </ProtectedRoute>
        );
      case 'settings':
        return (
          <ProtectedRoute requiredRole="admin">
            <Settings />
          </ProtectedRoute>
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: colors.primary,
      overflow: 'hidden'
    }}>
      {/* Modern Sidebar */}
      <div style={{
        width: '250px',
        backgroundColor: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px'
      }}>
        {/* Logo/Brand */}
        <div style={{
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            margin: 0,
            marginBottom: '0.25rem',
            color: colors.text
          }}>
            {businessName}
          </h1>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
            Offline
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '10px 12px',
                marginBottom: '6px',
                backgroundColor: currentPage === item.id ? hoverBg : 'transparent',
                border: 'none',
                borderRadius: '10px',
                borderLeft: currentPage === item.id ? `4px solid ${colors.accent}` : '4px solid transparent',
                color: currentPage === item.id ? colors.text : colors.textSecondary,
                fontSize: '14px',
                fontWeight: currentPage === item.id ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.backgroundColor = hoverBg;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '1.5rem',
          borderTop: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: colors.surface,
            borderRadius: '10px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: colors.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              {userRole === 'admin' ? '👑' : userRole === 'manager' ? '📊' : '🛒'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '2px'
              }}>
                Admin #{adminId}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: colors.textSecondary,
                textTransform: 'capitalize'
              }}>
                {userRole || 'admin'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.error,
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.errorBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.primary
      }}>
        {renderContent()}
      </div>
    </div>
  );
};

const SpecStatCard: React.FC<{ title: string; value: string; helper: string }> = ({ title, value, helper }) => (
  <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
    <div style={{ fontSize: '12px', color: 'var(--app-text-secondary)', fontWeight: 600 }}>{title}</div>
    <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 800, color: 'var(--app-text)' }}>{value}</div>
    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--app-text-secondary)' }}>{helper}</div>
  </div>
);

export default ModernDashboard;
