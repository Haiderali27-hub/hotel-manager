import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/SimpleAuthContext';
import type { DashboardStats } from '../services/DatabaseService';
import DatabaseService from '../services/DatabaseService';

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Test database connection
  const testDatabase = async () => {
    setLoading(true);
    setDbError(null);
    try {
      console.log('🔍 Testing database connection...');
      const stats = await DatabaseService.getDashboardStats();
      console.log('✅ Database response:', stats);
      setDbStats(stats);
      setTestMode(true);
    } catch (error) {
      console.error('❌ Database error:', error);
      setDbError(error instanceof Error ? error.message : 'Database connection failed');
    } finally {
      setLoading(false);
    }
  };

  // Load database data on component mount
  useEffect(() => {
    testDatabase();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('PKR', 'Rs.');
  };

  // Get display stats (real data when available and test mode is on, otherwise sample data)
  const getDisplayStats = () => {
    if (testMode && dbStats) {
      return [
        { 
          title: 'Total Guests This Month', 
          value: dbStats.totalGuests.toString(), 
          icon: '👥', 
          color: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          change: 'Real Data' 
        },
        { 
          title: 'Total Income', 
          value: dbStats.totalIncome.toLocaleString(), 
          currency: 'Rs.', 
          icon: '💰', 
          color: 'linear-gradient(135deg, #22C55E, #16A34A)',
          change: 'Real Data' 
        },
        { 
          title: 'Total Expenses', 
          value: dbStats.totalExpenses.toLocaleString(), 
          currency: 'Rs.', 
          icon: '💸', 
          color: 'linear-gradient(135deg, #EF4444, #DC2626)',
          change: 'Real Data' 
        },
        { 
          title: 'Profit/Loss', 
          value: dbStats.profitLoss.toLocaleString(), 
          currency: 'Rs.', 
          icon: dbStats.profitLoss >= 0 ? '📈' : '📉', 
          color: dbStats.profitLoss >= 0 
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : 'linear-gradient(135deg, #EF4444, #DC2626)',
          change: 'Real Data' 
        },
        { 
          title: 'Total Food Orders', 
          value: dbStats.totalFoodOrders.toString(), 
          icon: '🍽️', 
          color: 'linear-gradient(135deg, #F59E0B, #D97706)',
          change: 'Real Data' 
        },
        { 
          title: 'Active Guests', 
          value: dbStats.activeGuests.toString(), 
          icon: '👥', 
          color: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
          change: 'Real Data' 
        }
      ];
    }
    
    // Return sample data
    return stats;
  };

  // Sample data for stats - Professional hotel management dashboard
  const stats = [
    { 
      title: 'Total Guests This Month', 
      value: '248', 
      icon: '👥', 
      color: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      change: '+18%' 
    },
    { 
      title: 'Total Income', 
      value: '2,450,000', 
      currency: 'Rs.', 
      icon: '💰', 
      color: 'linear-gradient(135deg, #22C55E, #16A34A)',
      change: '+25%' 
    },
    { 
      title: 'Total Expenses', 
      value: '850,000', 
      currency: 'Rs.', 
      icon: '💸', 
      color: 'linear-gradient(135deg, #EF4444, #DC2626)',
      change: '+8%' 
    },
    { 
      title: 'Profit/Loss', 
      value: '1,600,000', 
      currency: 'Rs.', 
      icon: '📈', 
      color: 'linear-gradient(135deg, #10B981, #059669)',
      change: '+35%' 
    },
    { 
      title: 'Total Food Orders', 
      value: '432', 
      icon: '🍽️', 
      color: 'linear-gradient(135deg, #F59E0B, #D97706)',
      change: '+22%' 
    },
    { 
      title: 'Active Guests', 
      value: '67', 
      icon: '👥', 
      color: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      change: '+12%' 
    }
  ];

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

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1E1E2E',
      color: '#FFFFFF',
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
        backgroundColor: '#2D2D44',
        borderBottom: '1px solid #3D3D5C'
      }}>
        {/* Left side - Logo and Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={toggleSidebar}
            style={{
              backgroundColor: '#F59E0B',
              border: 'none',
              color: '#000',
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
          <div style={{
            backgroundColor: '#F59E0B',
            color: '#000',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '1.1rem'
          }}>
            🏨 Hotel Dashboard
          </div>
        </div>

        {/* Right side - Date and Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            color: '#A0A0B0' 
          }}>
            <span>📅</span>
            <span>Thursday, August 14, 2025</span>
          </div>
          <button
            onClick={logout}
            style={{
              backgroundColor: '#DC2626',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>🚪</span>
            Log Out
          </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998
          }}
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-300px',
          width: '300px',
          height: '100vh',
          backgroundColor: '#2D2D44',
          transition: 'left 0.3s ease-in-out',
          zIndex: 999,
          boxShadow: sidebarOpen ? '4px 0 20px rgba(0, 0, 0, 0.3)' : 'none',
          padding: '2rem'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #3D3D5C'
        }}>
          <h2 style={{
            color: '#F59E0B',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            margin: 0
          }}>
            Navigation
          </h2>
          <button
            onClick={toggleSidebar}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {navigationItems.map((item, index) => (
          <button
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              width: '100%',
              textAlign: 'left',
              marginBottom: '0.5rem',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3D3D5C';
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

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '2rem',
        backgroundColor: '#F5F5F5',
        overflow: 'auto'
      }}>
        {/* Page Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            color: '#333',
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0'
          }}>
            Total Overview
          </h1>
        </div>

        {/* Database Test Section */}
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            color: '#333', 
            fontSize: '1.2rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🗄️ Database Connection Test
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={testDatabase}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#9CA3AF' : '#3B82F6',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? '🔄 Testing...' : '🔍 Test Database'}
            </button>

            <button
              onClick={() => setTestMode(!testMode)}
              style={{
                backgroundColor: testMode ? '#10B981' : '#6B7280',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {testMode ? '📊 Show Real Data' : '📋 Show Sample Data'}
            </button>
          </div>

          {dbError && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              padding: '0.75rem',
              borderRadius: '6px',
              marginTop: '1rem'
            }}>
              ❌ Error: {dbError}
            </div>
          )}

          {dbStats && (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#16A34A',
              padding: '0.75rem',
              borderRadius: '6px',
              marginTop: '1rem'
            }}>
              ✅ Database Connected! 
              <br />
              <small>
                Real Data: {dbStats.totalGuests} guests, {formatCurrency(dbStats.totalIncome)} income, 
                {formatCurrency(dbStats.totalExpenses)} expenses, {dbStats.totalFoodOrders} orders
              </small>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {getDisplayStats().map((stat, index) => (
            <div
              key={index}
              style={{
                background: stat.color,
                padding: '2rem',
                borderRadius: '12px',
                color: 'white',
                position: 'relative',
                minHeight: '120px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {stat.change}
                </div>
              </div>
              
              <div>
                <h3 style={{
                  fontSize: '0.9rem',
                  margin: '0 0 0.5rem 0',
                  opacity: 0.9,
                  fontWeight: '500'
                }}>
                  {stat.title}
                </h3>
                
                <p style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  margin: 0,
                  lineHeight: 1
                }}>
                  {stat.value}
                  {stat.currency && (
                    <span style={{ 
                      fontSize: '1rem', 
                      marginLeft: '0.5rem',
                      opacity: 0.8 
                    }}>
                      {stat.currency}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Charts Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '2rem'
        }}>
          {/* Revenue Chart */}
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#333', marginBottom: '1rem' }}>Revenue</h3>
            <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#333',
              marginBottom: '1rem'
            }}>
              5,987.34
            </div>
            <div style={{
              height: '200px',
              backgroundColor: '#F8F9FA',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666'
            }}>
              📊 Revenue Chart
            </div>
          </div>

          {/* Revenue Statistics */}
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#333', marginBottom: '1rem' }}>Revenue Statistics</h3>
            <div style={{
              height: '200px',
              backgroundColor: '#F8F9FA',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666'
            }}>
              📈 Statistics Chart
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
