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
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [outOfStock, setOutOfStock] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartDateRange, setChartDateRange] = useState<'6months' | '3months' | '1month'>('6months');
  const [hoveredDataPoint, setHoveredDataPoint] = useState<number | null>(null);

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

      // Fetch additional dashboard metrics
      try {
        const products = await invoke<any[]>('get_menu_items');
        setTotalProducts(products.length);
        
        const totalStockQty = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
        setTotalStock(totalStockQty);
        
        const outOfStockCount = products.filter(p => (p.stock_quantity || 0) === 0).length;
        setOutOfStock(outOfStockCount);
      } catch (e) {
        console.error('Failed to load products:', e);
      }

      try {
        const customers = await invoke<any[]>('get_guests');
        setTotalCustomers(customers.length);
      } catch (e) {
        console.error('Failed to load customers:', e);
      }
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
        { id: 'accounts', label: 'Accounts/Customers', managerOnly: true },
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
      {/* Welcome Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: colors.text }}>
            Welcome {businessName}!
          </h1>
          <div style={{ marginTop: '4px', fontSize: '14px', color: colors.textSecondary }}>
            Overview of your business performance
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: '14px',
              width: '250px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Key Metrics - 4 Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard 
          title="Total Products" 
          value={String(totalProducts)} 
          icon="📦"
          color="#5483B3"
        />
        <MetricCard 
          title="Orders" 
          value={String(totalOrdersToday)} 
          icon="🛒"
          helper="Today"
          color="#8B5CF6"
        />
        <MetricCard 
          title="Total Stock" 
          value={String(totalStock)} 
          icon="📊"
          color="#10B981"
        />
        <MetricCard 
          title="Out of Stock" 
          value={String(outOfStock)} 
          icon="⚠️"
          color="#EF4444"
        />
      </div>

      {/* Second Row - 3 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        {/* No of customers */}
        <div className="bc-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: colors.textSecondary, marginBottom: '16px' }}>
            No of users
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}>
              👥
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: colors.text }}>
                {totalCustomers}
              </div>
              <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                Total Customers
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Values Pie Chart */}
        <div className="bc-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: colors.textSecondary, marginBottom: '16px' }}>
            Inventory Values
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Simple Pie Chart Visualization */}
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: `conic-gradient(#10B981 0% ${(totalStock > 0 ? ((totalStock - outOfStock) / totalStock * 100) : 0)}%, #EF4444 ${(totalStock > 0 ? ((totalStock - outOfStock) / totalStock * 100) : 0)}% 100%)`,
              }}></div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '20px',
                fontWeight: 800,
                color: colors.text
              }}>
                {totalStock > 0 ? Math.round((totalStock - outOfStock) / totalStock * 100) : 0}%
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10B981' }}></div>
                <span style={{ fontSize: '13px', color: colors.textSecondary }}>Available units</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#EF4444' }}></div>
                <span style={{ fontSize: '13px', color: colors.textSecondary }}>Out of stock</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Stores/Products */}
        <div className="bc-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: colors.textSecondary, marginBottom: '16px' }}>
            Top 5 Products
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lowStockItems.slice(0, 5).map((item, idx) => {
              const barColors = ['#8B5CF6', '#7C3AED', '#6366F1', '#4F46E5', '#5483B3'];
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, width: '20px' }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{
                      height: '6px',
                      backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      borderRadius: '3px',
                      marginTop: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (item.stock_quantity / (item.low_stock_limit * 2)) * 100)}%`,
                        backgroundColor: barColors[idx % barColors.length],
                        borderRadius: '3px'
                      }}></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>
                    {item.stock_quantity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expense vs Profit Line Chart */}
      <div className="bc-card" style={{ borderRadius: '12px', padding: '20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text }}>
            Expense vs Profit
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setChartDateRange('1month')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                backgroundColor: chartDateRange === '1month' ? colors.accent : 'transparent',
                color: chartDateRange === '1month' ? '#ffffff' : colors.textSecondary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              1M
            </button>
            <button
              onClick={() => setChartDateRange('3months')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                backgroundColor: chartDateRange === '3months' ? colors.accent : 'transparent',
                color: chartDateRange === '3months' ? '#ffffff' : colors.textSecondary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              3M
            </button>
            <button
              onClick={() => setChartDateRange('6months')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                backgroundColor: chartDateRange === '6months' ? colors.accent : 'transparent',
                color: chartDateRange === '6months' ? '#ffffff' : colors.textSecondary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              6M
            </button>
          </div>
        </div>
        
        {/* Line Chart */}
        <div style={{ position: 'relative', height: '220px', paddingTop: '20px' }}>
          {/* Y-axis labels */}
          <div style={{ position: 'absolute', left: '0', top: '20px', bottom: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: colors.textSecondary }}>
            <div>40k</div>
            <div>30k</div>
            <div>20k</div>
            <div>10k</div>
          </div>
          
          {/* Grid lines */}
          <div style={{ position: 'absolute', left: '40px', right: '0', top: '20px', bottom: '30px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, height: '1px', backgroundColor: colors.border, opacity: 0.3 }}></div>
            ))}
          </div>
          
          {/* Line chart area */}
          <div 
            style={{ position: 'absolute', left: '40px', right: '0', top: '20px', bottom: '30px' }}
            onMouseLeave={() => setHoveredDataPoint(null)}
          >
            <svg style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              {/* Define gradients for area fills */}
              <defs>
                <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              
              {/* Area fill for Profit (green) */}
              <polygon
                points="0,40 16.6,35 33.3,38 50,32 66.6,28 83.3,25 100,20 100,100 0,100"
                fill="url(#profitGradient)"
              />
              
              {/* Area fill for Expense (orange) */}
              <polygon
                points="0,50 16.6,48 33.3,52 50,45 66.6,38 83.3,42 100,35 100,100 0,100"
                fill="url(#expenseGradient)"
              />
              
              {/* Profit line (green) - slight upward trend */}
              <polyline
                points="0,40 16.6,35 33.3,38 50,32 66.6,28 83.3,25 100,20"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Expense line (orange) - fluctuating */}
              <polyline
                points="0,50 16.6,48 33.3,52 50,45 66.6,38 83.3,42 100,35"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Interactive data points */}
              {[
                { x: 0, profitY: 40, expenseY: 50, month: chartDateRange === '6months' ? 'Aug' : chartDateRange === '3months' ? 'Nov' : 'Jan', profit: 24000, expense: 20000 },
                { x: 16.6, profitY: 35, expenseY: 48, month: chartDateRange === '6months' ? 'Sep' : chartDateRange === '3months' ? 'Dec' : 'Jan 15', profit: 26000, expense: 20800 },
                { x: 33.3, profitY: 38, expenseY: 52, month: chartDateRange === '6months' ? 'Oct' : chartDateRange === '3months' ? 'Jan' : 'Feb 1', profit: 24800, expense: 19200 },
                { x: 50, profitY: 32, expenseY: 45, month: chartDateRange === '6months' ? 'Nov' : chartDateRange === '3months' ? 'Jan 15' : 'Feb 8', profit: 27200, expense: 22000 },
                { x: 66.6, profitY: 28, expenseY: 38, month: chartDateRange === '6months' ? 'Dec' : chartDateRange === '3months' ? 'Feb' : 'Feb 15', profit: 28800, expense: 24800 },
                { x: 83.3, profitY: 25, expenseY: 42, month: chartDateRange === '6months' ? 'Jan' : chartDateRange === '3months' ? 'Feb 15' : 'Feb 22', profit: 30000, expense: 23200 },
                { x: 100, profitY: 20, expenseY: 35, month: chartDateRange === '6months' ? 'Feb' : chartDateRange === '3months' ? 'Feb' : 'Mar', profit: 32000, expense: 26000 },
              ].map((point, idx) => (
                <g key={idx}>
                  {/* Invisible hover area */}
                  <rect
                    x={`${point.x - 8}%`}
                    y="0%"
                    width="16%"
                    height="100%"
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredDataPoint(idx)}
                  />
                  {/* Visible dots on hover */}
                  {hoveredDataPoint === idx && (
                    <>
                      <circle cx={`${point.x}%`} cy={`${point.profitY}%`} r="5" fill="#10B981" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <circle cx={`${point.x}%`} cy={`${point.expenseY}%`} r="5" fill="#F59E0B" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                </g>
              ))}
            </svg>
            
            {/* Tooltip on hover */}
            {hoveredDataPoint !== null && (() => {
              const dataPoints = [
                { x: 0, profitY: 40, expenseY: 50, month: chartDateRange === '6months' ? 'Aug' : chartDateRange === '3months' ? 'Nov' : 'Jan', profit: 24000, expense: 20000 },
                { x: 16.6, profitY: 35, expenseY: 48, month: chartDateRange === '6months' ? 'Sep' : chartDateRange === '3months' ? 'Dec' : 'Jan 15', profit: 26000, expense: 20800 },
                { x: 33.3, profitY: 38, expenseY: 52, month: chartDateRange === '6months' ? 'Oct' : chartDateRange === '3months' ? 'Jan' : 'Feb 1', profit: 24800, expense: 19200 },
                { x: 50, profitY: 32, expenseY: 45, month: chartDateRange === '6months' ? 'Nov' : chartDateRange === '3months' ? 'Jan 15' : 'Feb 8', profit: 27200, expense: 22000 },
                { x: 66.6, profitY: 28, expenseY: 38, month: chartDateRange === '6months' ? 'Dec' : chartDateRange === '3months' ? 'Feb' : 'Feb 15', profit: 28800, expense: 24800 },
                { x: 83.3, profitY: 25, expenseY: 42, month: chartDateRange === '6months' ? 'Jan' : chartDateRange === '3months' ? 'Feb 15' : 'Feb 22', profit: 30000, expense: 23200 },
                { x: 100, profitY: 20, expenseY: 35, month: chartDateRange === '6months' ? 'Feb' : chartDateRange === '3months' ? 'Feb' : 'Mar', profit: 32000, expense: 26000 },
              ];
              const point = dataPoints[hoveredDataPoint];
              return (
                <div style={{
                  position: 'absolute',
                  left: `${point.x}%`,
                  top: `${Math.min(point.profitY, point.expenseY) - 5}%`,
                  transform: 'translate(-50%, -100%)',
                  backgroundColor: theme === 'dark' ? 'rgba(2, 16, 36, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  minWidth: '140px',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.text, marginBottom: '6px' }}>
                    {point.month}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10B981' }}></div>
                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>Profit:</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.text, marginLeft: 'auto' }}>
                      {formatMoney(point.profit)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#F59E0B' }}></div>
                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>Expense:</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.text, marginLeft: 'auto' }}>
                      {formatMoney(point.expense)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
          
          {/* X-axis labels */}
          <div style={{ position: 'absolute', left: '40px', right: '0', bottom: '0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.textSecondary }}>
            {chartDateRange === '6months' ? 
              ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, idx) => <div key={idx}>{month}</div>) :
              chartDateRange === '3months' ?
              ['Nov', 'Dec', 'Jan', 'Jan 15', 'Feb', 'Feb 15', 'Feb'].map((month, idx) => <div key={idx}>{month}</div>) :
              ['Jan', 'Jan 15', 'Feb 1', 'Feb 8', 'Feb 15', 'Feb 22', 'Mar'].map((month, idx) => <div key={idx}>{month}</div>)
            }
          </div>
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '20px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '3px', backgroundColor: '#F59E0B', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>Expense</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '3px', backgroundColor: '#10B981', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>Profit</span>
          </div>
        </div>
      </div>

      {/* Revenue Today */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        <SpecStatCard title="Gross Revenue" value={formatMoney(grossRevenueToday)} helper="Today" />
        <SpecStatCard title="Paid Orders" value={String(paidCount)} helper="Completed" />
        <SpecStatCard title="Pending Payment" value={String(unpaidCount)} helper="Awaiting" />
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
      backgroundColor: theme === 'dark' ? colors.primary : '#c7e2eb',
      overflow: 'hidden'
    }}>
      {/* Modern Sidebar */}
      <div style={{
        width: sidebarVisible ? '280px' : '0px',
        backgroundColor: theme === 'dark' ? colors.surface : '#ffffff',
        borderRight: sidebarVisible ? `1px solid ${colors.border}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: sidebarVisible ? '20px 16px' : '0px',
        overflowY: 'auto',
        transition: 'width 0.22s ease, padding 0.22s ease',
        position: 'relative'
      }}>
        {/* User Profile at Top */}
        <div style={{
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #052659 0%, #5483B3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '700',
              color: 'white'
            }}>
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '15px',
                fontWeight: '700',
                color: colors.text,
                marginBottom: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                Admin #{adminId}
              </div>
              <div style={{
                fontSize: '13px',
                color: colors.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                admin@{businessName.toLowerCase().replace(/\s+/g, '')}.com
              </div>
            </div>
          </div>
        </div>

        {/* Logo/Brand */}
        <div style={{
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: 0,
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
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.textSecondary,
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ‹
            </button>
          </div>
        </div>

        {/* Collapse/Expand All Button */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={toggleAllCategories}
            title={navigationCategories.every(c => expandedCategories.has(c.category)) ? 'Collapse All' : 'Expand All'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {navigationCategories.every(c => expandedCategories.has(c.category)) ? '⊟' : '⊞'}
          </button>
        </div>

        {/* Categorized Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {/* Dashboard - Always first */}
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <button
              onClick={() => setCurrentPage('dashboard')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                backgroundColor: currentPage === 'dashboard' ? (theme === 'dark' ? 'rgba(84, 131, 179, 0.15)' : '#E8F4FD') : 'transparent',
                border: 'none',
                borderRadius: '12px',
                borderLeft: currentPage === 'dashboard' ? `4px solid ${colors.accent}` : '4px solid transparent',
                color: currentPage === 'dashboard' ? colors.accent : colors.text,
                fontSize: '15px',
                fontWeight: currentPage === 'dashboard' ? '700' : '600',
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
              <span style={{ fontSize: '18px' }}>🏠</span>
              <span>Dashboard</span>
            </button>
          </div>

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
              <div key={category.category} style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => toggleCategory(category.category)}
                  style={{ 
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px', 
                    fontSize: '10px', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    color: theme === 'dark' ? '#7DA0CA' : '#052659', 
                    letterSpacing: '1px',
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
                  <span style={{ fontSize: '14px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                </button>
                {isExpanded && filteredItems.map((item) => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setCurrentPage(item.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 12px 12px 20px',
                        marginBottom: '6px',
                        marginTop: '2px',
                        backgroundColor: currentPage === item.id ? (theme === 'dark' ? 'rgba(84, 131, 179, 0.15)' : '#E8F4FD') : 'transparent',
                        border: 'none',
                        borderRadius: '12px',
                        borderLeft: currentPage === item.id ? `4px solid ${colors.accent}` : '4px solid transparent',
                        color: currentPage === item.id ? colors.accent : colors.text,
                        fontSize: '14px',
                        fontWeight: currentPage === item.id ? '700' : '500',
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
                  </div>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Logout at Bottom */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: colors.error,
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
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
        backgroundColor: theme === 'dark' ? colors.primary : '#c7e2eb',
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
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
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

const MetricCard: React.FC<{ title: string; value: string; icon: string; helper?: string; color: string }> = ({ 
  title, 
  value, 
  icon, 
  helper, 
  color 
}) => {
  const { colors } = useTheme();
  
  return (
    <div className="bc-card" style={{ borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: 600, marginBottom: '8px' }}>
            {title}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text, marginBottom: '4px' }}>
            {value}
          </div>
          {helper && (
            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
              {helper}
            </div>
          )}
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: color + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px'
        }}>
          {icon}
        </div>
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
