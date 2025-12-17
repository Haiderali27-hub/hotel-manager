import React, { useEffect, useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/SimpleAuthContext';
import { getGradientColors, useTheme } from '../context/ThemeContext';
import type { DashboardStats } from '../services/DatabaseService';
import DatabaseService from '../services/DatabaseService';
import ActiveGuests from './ActiveGuests';
import AddExpense from './AddExpense';
import AddFoodOrder from './AddFoodOrder';
import AddGuest from './AddGuest';
import History from './History';
import ManageMenuRooms from './ManageMenuRooms';
import MonthlyReport from './MonthlyReport';
import Settings from './SettingsNew';

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const { theme, colors, toggleTheme } = useTheme();
  const { formatMoney } = useCurrency();
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

  const handleNavigation = (title: string) => {
    switch (title) {
      case 'Add Guest':
        setCurrentPage('add-guest');
        break;
      case 'Add Food Order':
        setCurrentPage('add-food-order');
        break;
      case 'Active Guests':
        setCurrentPage('active-guests');
        break;
      case 'Add Expense':
        setCurrentPage('add-expense');
        break;
      case 'History':
        setCurrentPage('history');
        break;
      case 'Monthly Report':
        setCurrentPage('monthly-report');
        break;
      case 'Manage Menu / Rooms':
        setCurrentPage('manage-menu-rooms');
        break;
      case 'Settings':
        setCurrentPage('settings');
        break;
      default:
        setCurrentPage('dashboard');
    }
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const goBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const refreshData = async () => {
    try {
      const stats = await DatabaseService.getDashboardStats();
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
          title: 'Total Guests This Month', 
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
          title: 'Total Food Orders', 
          value: dbStats.total_food_orders.toString(), 
          icon: '🍽️', 
          color: gradients.warning,
          change: 'Real Data' 
        },
        { 
          title: 'Active Guests', 
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
        title: 'Total Guests This Month', 
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
        title: 'Total Food Orders', 
        value: '156', 
        icon: '🍽️', 
        color: gradients.warning,
        change: '+23%' 
      },
      { 
        title: 'Active Guests', 
        value: '8', 
        icon: '👥', 
        color: gradients.accent,
        change: '+5%' 
      }
    ];
  };

  const navigationItems = [
    { title: 'Add Guest', icon: '➕' },
    { title: 'Add Food Order', icon: '🍲' },
    { title: 'Active Guests', icon: '👥' },
    { title: 'Add Expense', icon: '💵' },
    { title: 'History', icon: '📋' },
    { title: 'Monthly Report', icon: '📊' },
    { title: 'Manage Menu / Rooms', icon: '🧾' },
    { title: 'Settings', icon: '⚙️' }
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
        backgroundColor: '#0a1920',
        borderBottom: `1px solid ${colors.border}`
      }}>
        {/* Left side - Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={toggleSidebar}
            style={{
              backgroundColor: colors.accent,
              border: 'none',
              color: theme === 'dark' ? '#000' : '#FFFFFF',
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
              alt="Hotel Logo"
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
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
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
                  color: currentPage === 'dashboard' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
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
                onClick={() => handleQuickNavigation('add-guest')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'add-guest' ? colors.accent : 'transparent',
                  color: currentPage === 'add-guest' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'add-guest') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'add-guest') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                👤 Add Guest
              </div>
              <div
                onClick={() => handleQuickNavigation('active-guests')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'active-guests' ? colors.accent : 'transparent',
                  color: currentPage === 'active-guests' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'active-guests') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'active-guests') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                🏨 Active Guests
              </div>
              <div
                onClick={() => handleQuickNavigation('add-food-order')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'add-food-order' ? colors.accent : 'transparent',
                  color: currentPage === 'add-food-order' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'add-food-order') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'add-food-order') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                🍽️ Add Food Order
              </div>
              <div
                onClick={() => handleQuickNavigation('manage-menu-rooms')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'manage-menu-rooms' ? colors.accent : 'transparent',
                  color: currentPage === 'manage-menu-rooms' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 'manage-menu-rooms') {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 'manage-menu-rooms') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                ⚙️ Manage Menu/Rooms
              </div>
              <div
                onClick={() => handleQuickNavigation('history')}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: currentPage === 'history' ? colors.accent : 'transparent',
                  color: currentPage === 'history' ? (theme === 'dark' ? '#000' : '#FFFFFF') : colors.text,
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
          <span style={{ color: colors.textMuted }}>Admin</span>
          <button
            onClick={logout}
            style={{
              backgroundColor: colors.error,
              border: 'none',
              color: '#FFFFFF',
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
                onClick={() => handleNavigation(item.title)}
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
          backgroundColor: currentPage === 'dashboard' ? (theme === 'light' ? '#F5F5F5' : colors.primary) : colors.primary,
          overflow: 'auto'
        }}>
          {currentPage === 'dashboard' && renderDashboardContent()}
          {currentPage === 'add-guest' && (
            <AddGuest 
              onBack={goBackToDashboard} 
              onGuestAdded={refreshData}
            />
          )}
          {currentPage === 'add-food-order' && (
            <AddFoodOrder 
              onBack={goBackToDashboard} 
              onOrderAdded={refreshData}
            />
          )}
          {currentPage === 'add-expense' && (
            <AddExpense 
              onBack={goBackToDashboard} 
              onExpenseAdded={refreshData}
            />
          )}
          {currentPage === 'active-guests' && (
            <ActiveGuests 
              onBack={goBackToDashboard}
              onAddOrder={() => {
                setCurrentPage('add-food-order');
              }}
            />
          )}
          {currentPage === 'manage-menu-rooms' && (
            <ManageMenuRooms 
              onBack={() => {
                goBackToDashboard();
                refreshData();
              }}
            />
          )}
          {currentPage === 'history' && (
            <History 
              onBack={goBackToDashboard}
            />
          )}
          {currentPage === 'monthly-report' && (
            <MonthlyReport 
              onBack={goBackToDashboard}
            />
          )}
          {currentPage === 'settings' && (
            <Settings />
          )}
          {/* TODO: Add other page components */}
          {currentPage !== 'dashboard' && 
           currentPage !== 'add-guest' && 
           currentPage !== 'add-food-order' && 
           currentPage !== 'add-expense' && 
           currentPage !== 'active-guests' && 
           currentPage !== 'history' && 
           currentPage !== 'monthly-report' && 
           currentPage !== 'manage-menu-rooms' && 
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
                  color: theme === 'dark' ? '#000' : '#FFFFFF',
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
