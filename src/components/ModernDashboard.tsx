import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useTheme } from '../context/ThemeContext';
import AccountsPage from './AccountsPage';
import AddSale from './AddSale';
import ExpensesPage from './ExpensesPage';
import FinancialReport from './FinancialReport';
import ProductsPage from './ProductsPage';
import { ProtectedRoute } from './ProtectedRoute';
import PurchasesPage from './PurchasesPage';
import ReturnsPage from './ReturnsPage';
import SalesHistoryPage from './SalesHistoryPage';
import Settings from './SettingsNew';
import StockAdjustmentsPage from './StockAdjustmentsPage';
import SuppliersPage from './SuppliersPage';

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
  const { mode, flags } = useLabels();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try {
      const raw = localStorage.getItem('bm-sidebar-visible');
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch {
      // Ignore storage errors.
    }
    return true;
  });
  const [businessName, setBusinessName] = useState('INERTIA');
  const [recentSales, setRecentSales] = useState<SaleSummary[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Sales & Customers', 'Inventory & Products', 'Financial', 'Management'])
  );

  useEffect(() => {
    loadDashboardData();
    loadBusinessName();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bm-sidebar-visible', sidebarVisible ? '1' : '0');
    } catch {
      // Ignore storage errors.
    }
  }, [sidebarVisible]);

  const loadDashboardData = async () => {
    try {
      // Used for "Recent Activity" and today's revenue/order counts.
      const sales = await invoke<SaleSummary[]>('get_sales');
      setRecentSales(sales);

      const rows: any[] = await invoke('get_low_stock_items');
      const lowStock: LowStockItem[] = rows.map((raw) => ({
        id: raw.id,
        name: raw.name,
        stock_quantity: raw.stock_quantity ?? raw.stockQuantity ?? 0,
        low_stock_limit: raw.low_stock_limit ?? raw.lowStockLimit ?? 0,
      }));
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

  const posNavLabel = (() => {
    if (flags.retailQuickScan) return 'POS';
    if (flags.restaurantKitchen) return 'Orders';
    if (mode === 'salon') return 'Services';
    return 'Sales';
  })();

  type NavItem = { id: string; label: string; managerOnly?: boolean; adminOnly?: boolean };
  type NavCategory = { category: string; items: NavItem[] };
  
  const navigationCategories: NavCategory[] = [
    {
      category: 'Sales & Customers',
      items: [
        { id: 'pos', label: posNavLabel },
        { id: 'accounts', label: 'Accounts', managerOnly: true },
      ],
    },
    {
      category: 'Inventory & Products',
      items: [
        { id: 'products', label: 'Products' },
        { id: 'purchases', label: 'Purchases (Stock-In)', managerOnly: true },
        { id: 'stock-adjustments', label: 'Stock Adjustments', managerOnly: true },
        { id: 'suppliers', label: 'Suppliers', managerOnly: true },
        { id: 'returns', label: 'Returns & Refunds', managerOnly: true },
      ],
    },
    {
      category: 'Financial',
      items: [
        { id: 'expenses', label: 'Expenses', managerOnly: true },
        { id: 'sales-history', label: 'History' },
        { id: 'reports', label: 'Reports', managerOnly: true },
      ],
    },
    {
      category: 'Management',
      items: [
        { id: 'settings', label: 'Settings', adminOnly: true },
      ],
    },
  ];

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const toggleAllCategories = () => {
    const allCategoryNames = navigationCategories.map(c => c.category);
    const allExpanded = allCategoryNames.every(name => expandedCategories.has(name));
    
    if (allExpanded) {
      // Collapse all
      setExpandedCategories(new Set());
    } else {
      // Expand all
      setExpandedCategories(new Set(allCategoryNames));
    }
  };

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

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const last7Days = (() => {
    const today = startOfDay(new Date());
    const days: Array<{ key: string; label: string; date: Date; revenue: number; orders: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        date: d,
        revenue: 0,
        orders: 0,
      });
    }

    const byKey = new Map(days.map((x) => [x.key, x] as const));
    for (const s of recentSales) {
      const dt = new Date(s.created_at);
      if (Number.isNaN(dt.getTime())) continue;
      const k = startOfDay(dt).toISOString().slice(0, 10);
      const bucket = byKey.get(k);
      if (!bucket) continue;
      bucket.revenue += s.total_amount || 0;
      bucket.orders += 1;
    }
    return days;
  })();

  const maxRevenue7 = Math.max(1, ...last7Days.map((d) => d.revenue));
  const maxOrders7 = Math.max(1, ...last7Days.map((d) => d.orders));

  const unpaidCount = recentSales.filter((s) => !s.paid).length;
  const paidCount = recentSales.filter((s) => s.paid).length;

  const prepareDuplicateSale = async (saleId: number) => {
    try {
      const details = await invoke<any>('get_sale_details', { orderId: saleId });
      const items = (details?.items ?? []) as Array<{ menu_item_id?: number; quantity: number; unit_price: number; item_name: string }>;
      const draft = {
        sourceSaleId: saleId,
        createdAt: new Date().toISOString(),
        items: items
          .filter((it) => typeof it.menu_item_id === 'number' && it.menu_item_id)
          .map((it) => ({
            menu_item_id: it.menu_item_id as number,
            quantity: it.quantity,
            unit_price: it.unit_price,
            item_name: it.item_name,
          })),
      };
      localStorage.setItem('bm_pos_draft', JSON.stringify(draft));
      setCurrentPage('pos');
    } catch (e) {
      console.error('Failed to prepare duplicate sale:', e);
    }
  };

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: colors.text, marginBottom: '10px' }}>Revenue (7 days)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
            {last7Days.map((d) => (
              <div key={d.key} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <div
                  title={formatMoney(d.revenue)}
                  style={{
                    height: `${Math.round((d.revenue / maxRevenue7) * 100)}%`,
                    minHeight: d.revenue > 0 ? '6px' : '2px',
                    background: colors.accent,
                    borderRadius: '10px',
                    opacity: 0.85,
                  }}
                />
                <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: colors.text, marginBottom: '10px' }}>Orders (7 days)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
            {last7Days.map((d) => (
              <div key={d.key} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <div
                  title={`${d.orders} orders`}
                  style={{
                    height: `${Math.round((d.orders / maxOrders7) * 100)}%`,
                    minHeight: d.orders > 0 ? '6px' : '2px',
                    background: colors.textSecondary,
                    borderRadius: '10px',
                    opacity: 0.7,
                  }}
                />
                <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary }}>{d.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '12px', fontSize: '12px', color: colors.textSecondary }}>
            <div>
              Paid: <strong style={{ color: colors.text }}>{paidCount}</strong>
            </div>
            <div>
              Unpaid: <strong style={{ color: unpaidCount > 0 ? colors.error : colors.text }}>{unpaidCount}</strong>
            </div>
          </div>
        </div>
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
        return <AddSale onBack={() => setCurrentPage('dashboard')} onSaleAdded={loadDashboardData} onNavigateToAccounts={() => setCurrentPage('accounts')} />;
      case 'products':
        return <ProductsPage onBack={() => setCurrentPage('dashboard')} />;
      case 'purchases':
        return (
          <ProtectedRoute requiredRole="manager">
            <PurchasesPage onBack={() => setCurrentPage('dashboard')} />
          </ProtectedRoute>
        );
      case 'stock-adjustments':
        return (
          <ProtectedRoute requiredRole="manager">
            <StockAdjustmentsPage onBack={() => setCurrentPage('dashboard')} />
          </ProtectedRoute>
        );
      case 'returns':
        return (
          <ProtectedRoute requiredRole="manager">
            <ReturnsPage onBack={() => setCurrentPage('dashboard')} />
          </ProtectedRoute>
        );
      case 'suppliers':
        return (
          <ProtectedRoute requiredRole="manager">
            <SuppliersPage onBack={() => setCurrentPage('dashboard')} />
          </ProtectedRoute>
        );
      case 'accounts':
        return (
          <ProtectedRoute requiredRole="manager">
            <AccountsPage onBack={() => setCurrentPage('dashboard')} onNavigateToPOS={() => setCurrentPage('pos')} />
          </ProtectedRoute>
        );
      case 'sales-history':
        return (
          <SalesHistoryPage
            onBack={() => setCurrentPage('dashboard')}
            onDuplicateSale={(saleId) => void prepareDuplicateSale(saleId)}
          />
        );
      case 'expenses':
        return (
          <ProtectedRoute requiredRole="manager">
            <ExpensesPage onBack={() => setCurrentPage('dashboard')} onExpenseChanged={loadDashboardData} />
          </ProtectedRoute>
        );
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
        width: sidebarVisible ? '250px' : '0px',
        backgroundColor: colors.surface,
        borderRight: sidebarVisible ? `1px solid ${colors.border}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: sidebarVisible ? '18px 14px' : '0px',
        overflow: 'hidden',
        transition: 'width 0.22s ease, padding 0.22s ease'
      }}>
        {/* Logo/Brand */}
        <div style={{
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: 0,
              marginBottom: '0.25rem',
              color: colors.text,
              minWidth: 0
            }}>
              {businessName}
            </h1>

            <button
              type="button"
              onClick={() => setSidebarVisible(false)}
              title="Hide sidebar"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.textSecondary,
                cursor: 'pointer'
              }}
            >
              ‹
            </button>
          </div>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
            Offline
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: colors.textSecondary }}>
            Mode: {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {/* Toggle All Categories Button */}
          <button
            onClick={toggleAllCategories}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginBottom: '12px',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textSecondary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hoverBg;
              e.currentTarget.style.borderColor = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <span>{navigationCategories.every(c => expandedCategories.has(c.category)) ? 'Collapse All' : 'Expand All'}</span>
            <span style={{ fontSize: '14px' }}>☰</span>
          </button>

          {/* Dashboard - Always shown first */}
          <button
            onClick={() => setCurrentPage('dashboard')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '10px 12px',
              marginBottom: '16px',
              backgroundColor: currentPage === 'dashboard' ? hoverBg : 'transparent',
              border: 'none',
              borderRadius: '10px',
              borderLeft: currentPage === 'dashboard' ? `4px solid ${colors.accent}` : '4px solid transparent',
              color: currentPage === 'dashboard' ? colors.text : colors.textSecondary,
              fontSize: '14px',
              fontWeight: currentPage === 'dashboard' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 'dashboard') {
                e.currentTarget.style.backgroundColor = hoverBg;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 'dashboard') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span>Dashboard</span>
          </button>

          {/* Categorized Navigation */}
          {navigationCategories.map((category) => {
            const filteredItems = category.items.filter((item) => {
              if (item.adminOnly) return userRole === 'admin';
              if (item.managerOnly) return userRole === 'admin' || userRole === 'manager';
              return true;
            });
            
            if (filteredItems.length === 0) return null;
            
            const isExpanded = expandedCategories.has(category.category);
            
            return (
              <div key={category.category} style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => toggleCategory(category.category)}
                  style={{ 
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px', 
                    fontSize: '12px', 
                    fontWeight: 900, 
                    textTransform: 'uppercase', 
                    color: colors.text, 
                    letterSpacing: '0.5px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{category.category}</span>
                  <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                </button>
                {isExpanded && filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '10px 12px 10px 20px',
                      marginBottom: '4px',
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
              </div>
            );
          })}
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
        backgroundColor: colors.primary,
        position: 'relative'
      }}>
        {!sidebarVisible && (
          <button
            type="button"
            onClick={() => setSidebarVisible(true)}
            title="Show sidebar"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 50,
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              boxShadow: `0 6px 20px ${colors.shadow}`,
              cursor: 'pointer'
            }}
          >
            ☰
          </button>
        )}
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
