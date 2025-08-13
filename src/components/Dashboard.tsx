import React from 'react';
import { useAuth } from '../context/SimpleAuthContext';

export const Dashboard: React.FC = () => {
  const { logout, adminId } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Success Header */}
      <div style={{
        backgroundColor: '#28a745',
        color: 'white',
        padding: '2rem',
        borderRadius: '10px',
        textAlign: 'center',
        marginBottom: '2rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        maxWidth: '800px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          margin: '0 0 1rem 0',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🎉 SUCCESS! 🎉
        </h1>
        <h2 style={{
          fontSize: '1.8rem',
          margin: '0 0 1rem 0',
          fontWeight: '600'
        }}>
          You are now logged into the Hotel Management System!
        </h2>
        <p style={{
          fontSize: '1.2rem',
          margin: '0',
          opacity: '0.9'
        }}>
          Welcome, Admin! The system is ready for use.
        </p>
      </div>

      {/* Main Dashboard Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '15px',
        padding: '2rem',
        maxWidth: '1000px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            color: '#333',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            Hotel Management Dashboard
          </h3>
          <p style={{
            color: '#666',
            fontSize: '1.1rem',
            marginBottom: '0'
          }}>
            Logged in as: <strong>Administrator</strong>
          </p>
        </div>

        {/* Dashboard Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(45deg, #FF6B6B, #FF8E8E)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(255,107,107,0.3)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Guest Management</h4>
            <p style={{ margin: '0', opacity: '0.9' }}>Manage guest bookings and check-ins</p>
          </div>

          <div style={{
            background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(78,205,196,0.3)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Room Management</h4>
            <p style={{ margin: '0', opacity: '0.9' }}>View and manage room availability</p>
          </div>

          <div style={{
            background: 'linear-gradient(45deg, #45B7D1, #96C93D)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(69,183,209,0.3)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Reports</h4>
            <p style={{ margin: '0', opacity: '0.9' }}>Generate and view reports</p>
          </div>
        </div>

        {/* Logout Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '12px 30px',
              borderRadius: '25px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(220,53,69,0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#c82333';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#dc3545';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '2rem',
        textAlign: 'center',
        color: 'white',
        opacity: '0.8'
      }}>
        <p style={{ margin: '0', fontSize: '0.9rem' }}>
          Hotel Management System v1.0 - Offline Mode
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
