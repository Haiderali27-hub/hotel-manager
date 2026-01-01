import React, { useEffect, useState } from 'react';
import { getDashboardStats, type DashboardStats } from '../api/client';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { getGradientColors, useTheme } from '../context/ThemeContext';
import ActiveCustomers from './ActiveCustomers';
import AddCustomer from './AddCustomer';
import AddExpense from './AddExpense';
import AddSale from './AddSale';
import FinancialReport from './FinancialReport';
import History from './History';
import LowStockAlert from './LowStockAlert';
import ManageCatalogResources from './ManageCatalogResources';
import { ProtectedRoute } from './ProtectedRoute';
import Settings from './SettingsNew';
import ShiftManager from './ShiftManager';

const Dashboard: React.FC = () => {
  const { logout, userRole, adminId } = useAuth();
  const { theme, colors, toggleTheme } = useTheme();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  const gradients = getGradientColors(theme);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [showNavDropdown, setShowNavDropdown] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleNavDropdown = () => {
    setShowNavDropdown(!showNavDropdown);
  };

  const handleQuickNavigation = (page: string) => {
    setCurrentPage(page);
    setShowNavDropdown(false);
  };

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const goBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const refreshData = async () => {
    try {
      const stats = await getDashboardStats();
      setDbStats(stats);
    } catch (error) {
      console.error('Database error:', error);
    }
  };

  // Load database data on component mount
  useEffect(() => {
    refreshData();
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNavDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-nav-dropdown]')) {
          setShowNavDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNavDropdown]);

  // Get display stats (real data when available, otherwise sample data)
  const getDisplayStats = () => {
    if (dbStats) {
      return [
        { 
          title: 'Total Customers This Month', 
          value: dbStats.total_guests_this_month.toString(), 
          icon: '👥', 
          color: gradients.primary,
          change: 'Real Data' 
        },
        { 
          title: 'Total Income', 
          value: formatMoney(dbStats.total_income, { maximumFractionDigits: 0 }),
          icon: '💰', 
          color: gradients.success,
          change: 'Real Data' 
        },
        { 
          title: 'Total Expenses', 
          value: formatMoney(dbStats.total_expenses, { maximumFractionDigits: 0 }),
          icon: '💸', 
          color: gradients.error,
          change: 'Real Data' 
        },
        { 
          title: 'Profit/Loss', 
          value: formatMoney(dbStats.profit_loss, { maximumFractionDigits: 0 }),
          icon: dbStats.profit_loss >= 0 ? '📈' : '📉', 
          color: dbStats.profit_loss >= 0 
            ? gradients.info
            : gradients.error,
          change: 'Real Data' 
        },
        { 
          title: 'Total Sales', 
          value: dbStats.total_food_orders.toString(), 
          icon: '🍽️', 
          color: gradients.warning,
          change: 'Real Data' 
        },
        { 
          title: `Active ${label.client}s`, 
          value: dbStats.active_guests.toString(), 
          icon: '👥', 
          color: gradients.accent,
          change: 'Real Data' 
        }
      ];
    }

    // Sample data fallback
    return [
      { 
        title: `Total ${label.client}s This Month`, 
        value: '42', 
        icon: '👥', 
        color: gradients.primary,
        change: '+12%' 
      },
      { 
        title: 'Total Income', 
        value: '84,500', 
        icon: '💰', 
        color: gradients.success,
        change: '+8%' 
      },
      { 
        title: 'Total Expenses', 
        value: '12,300', 
        icon: '💸', 
        color: gradients.error,
        change: '-4%' 
      },
      { 
        title: 'Profit/Loss', 
        value: '72,200', 
        icon: '📈', 
        color: gradients.info,
        change: '+15%' 
      },
      { 
        title: 'Total Sales', 
        value: '156', 
        icon: '🍽️', 
        color: gradients.warning,
        change: '+23%' 
      },
      { 
        title: `Active ${label.client}s`, 
        value: '8', 
        icon: '👥', 
        color: gradients.accent,
        change: '+5%' 
      }
    ];
  };

  const navigationItems = [
    { page: 'add-customer', title: 'Add Customer', icon: '➕' },
    { page: 'add-sale', title: 'Add Sale', icon: '🧾' },
    { page: 'active-customers', title: 'Active Customers', icon: '👥' },
    { page: 'add-expense', title: 'Add Expense', icon: '💵' },
    { page: 'history', title: 'History', icon: '📋' },
    { page: 'financial-report', title: 'Financial Report', icon: '📊' },
    { page: 'shifts', title: 'Shift Management', icon: '💼' },
    { page: 'manage-catalog-resources', title: 'Manage Catalog / Resources', icon: '⚙️' },
    { page: 'settings', title: 'Settings', icon: '⚙️' }
  ];

  const renderDashboardContent = () => {
    return (
      <div style={{ padding: '2rem' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            color: colors.text,
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0'
          }}>
            Total Overview
          </h1>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {getDisplayStats().map((stat, index) => (
            <div
              key={index}
              style={{
                background: stat.color,
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    margin: '0 0 0.5rem 0',
                    opacity: 0.9
                  }}>
                    {stat.title}
                  </h3>
                  <p style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {stat.value}
                  </p>
                </div>
                <span style={{ fontSize: '2rem', opacity: 0.8 }}>{stat.icon}</span>
              </div>
              <p style={{
                fontSize: '0.875rem',
                margin: 0,
                opacity: 0.8
              }}>
                {stat.change}
              </p>
            </div>
          ))}
        </div>

        {/* Low Stock Alert (Phase 4) */}
        <LowStockAlert />
      </div>
    );
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: colors.primary,
      color: colors.text,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        backgroundColor: 'var(--bm-primary)',
        borderBottom: `1px solid ${colors.border}`
      }}>
        {/* Left side - Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={toggleSidebar}
            style={{
              backgroundColor: colors.accent,
              border: 'none',
              color: theme === 'dark' ? 'black' : 'white',
              padding: '0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ☰
          </button>
        </div>

        {/* Center - Logo with Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          position: 'relative'
        }}>
          <div
            data-nav-dropdown
            onClick={toggleNavDropdown}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
              backgroundColor: showNavDropdown ? colors.surface : 'transparent'
            }}
            title="Quick navigation menu"
          >
            <img 
              src={logoImage} 
              alt="Logo"
              style={{
                height: '50px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Navigation Dropdown */}
          {showNavDropdown && (
            <div 
              data-nav-dropdown
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '0.5rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                boxShadow: `0 4px 12px ${colors.shadow}`,
                zIndex: 1000,
                minWidth: '200px',
                padding: '0.5rem 0'
              }}
            >
              <div
                onClick={() => handleQuickNavigation('dashboard')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'dashboard' ? colors.accent : 'transparent',
                  color: currentPage === 'dashboard' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'dashboard') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'dashboard') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                🏠 Dashboard
              </div>
              <div
                onClick={() => handleQuickNavigation('add-customer')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'add-customer' ? colors.accent : 'transparent',
                  color: currentPage === 'add-customer' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'add-customer') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'add-customer') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                👤 Add Customer
              </div>
              <div
                onClick={() => handleQuickNavigation('active-customers')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'active-customers' ? colors.accent : 'transparent',
                  color: currentPage === 'active-customers' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'active-customers') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'active-customers') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                👥 Active Customers
              </div>
              <div
                onClick={() => handleQuickNavigation('add-sale')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'add-sale' ? colors.accent : 'transparent',
                  color: currentPage === 'add-sale' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'add-sale') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'add-sale') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                🧾 Add Sale
              </div>
              <div
                onClick={() => handleQuickNavigation('manage-catalog-resources')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'manage-catalog-resources' ? colors.accent : 'transparent',
                  color: currentPage === 'manage-catalog-resources' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'manage-catalog-resources') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'manage-catalog-resources') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                ⚙️ Manage Catalog/Resources
              </div>
              <div
                onClick={() => handleQuickNavigation('history')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'history' ? colors.accent : 'transparent',
                  color: currentPage === 'history' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'history') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'history') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                📊 History
              </div>
              <div
                onClick={() => handleQuickNavigation('shifts')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'shifts' ? colors.accent : 'transparent',
                  color: currentPage === 'shifts' ? (theme === 'dark' ? 'black' : 'white') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'shifts') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'shifts') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                💼 Shift Management
              </div>
            </div>
          )}
        </div>

        {/* Right side - Theme toggle, User info and logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={toggleTheme}
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              padding: '0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            <span style={{ color: colors.text, fontSize: '0.875rem', fontWeight: '600' }}>Admin #{adminId}</span>
            <span
              style={{
                color: '#fff',
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                background:
                  userRole === 'admin'
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : userRole === 'manager'
                    ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                    : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              }}
            >
              {userRole === 'admin' ? '👑 Admin' : userRole === 'manager' ? '📊 Manager' : '🛒 Staff'}
            </span>
          </div>
          <button
            onClick={logout}
            style={{
              backgroundColor: colors.error,
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? '250px' : '0',
          backgroundColor: colors.secondary,
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          borderRight: `1px solid ${colors.border}`
        }}>
          <div style={{ padding: '1rem', width: '250px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: `1px solid ${colors.border}`
            }}>
              <h3 style={{
                color: colors.accent,
                fontSize: '1.1rem',
                fontWeight: '600',
                margin: 0
              }}>
                Navigation
              </h3>
              <button
                onClick={toggleSidebar}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '1.2rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {navigationItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleNavigation(item.page)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.text,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: '0.5rem',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          backgroundColor: colors.primary,
          overflow: 'auto'
        }}>
          {currentPage === 'dashboard' && renderDashboardContent()}
          {currentPage === 'add-customer' && (
            <AddCustomer 
              onBack={goBackToDashboard} 
              onCustomerAdded={refreshData}
            />
          )}
          {currentPage === 'add-sale' && (
            <AddSale 
              onBack={goBackToDashboard} 
              onSaleAdded={refreshData}
            />
          )}
          {currentPage === 'add-expense' && (
            <AddExpense 
              onBack={goBackToDashboard} 
              onExpenseAdded={refreshData}
            />
          )}
          {currentPage === 'active-customers' && (
            <ActiveCustomers 
              onBack={goBackToDashboard}
              onAddSale={() => {
                setCurrentPage('add-sale');
              }}
            />
          )}
          {currentPage === 'manage-catalog-resources' && (
            <ManageCatalogResources 
              onBack={() => {
                goBackToDashboard();
                refreshData();
              }}
            />
          )}
          {currentPage === 'history' && (
            <ProtectedRoute requiredRole="manager">
              <History 
                onBack={goBackToDashboard}
              />
            </ProtectedRoute>
          )}
          {currentPage === 'financial-report' && (
            <ProtectedRoute requiredRole="manager">
              <FinancialReport 
                onBack={goBackToDashboard}
              />
            </ProtectedRoute>
          )}
          {currentPage === 'shifts' && (
            <ProtectedRoute requiredRole="manager">
              <ShiftManager />
            </ProtectedRoute>
          )}
          {currentPage === 'settings' && (
            <ProtectedRoute requiredRole="admin">
              <Settings />
            </ProtectedRoute>
          )}
          {/* TODO: Add other page components */}
          {currentPage !== 'dashboard' && 
           currentPage !== 'add-customer' && 
           currentPage !== 'add-sale' && 
           currentPage !== 'add-expense' && 
           currentPage !== 'active-customers' && 
           currentPage !== 'history' && 
           currentPage !== 'financial-report' && 
           currentPage !== 'shifts' && 
           currentPage !== 'manage-catalog-resources' && 
           currentPage !== 'settings' && (
            <div style={{
              padding: '2rem',
              color: colors.text,
              textAlign: 'center'
            }}>
              <h1>Coming Soon</h1>
              <p style={{ color: colors.textSecondary }}>This feature is under development.</p>
              <button
                onClick={goBackToDashboard}
                style={{
                  backgroundColor: colors.accent,
                  color: theme === 'dark' ? 'black' : 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginTop: '1rem'
                }}
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
