import React from 'react';
import './App.css';

import Dashboard from './components/Dashboard';
import NotificationToast from './components/NotificationToast';
import OfflineLoginPage from './components/OfflineLoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { LabelProvider } from './context/LabelContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: 'var(--app-bg)'
      }}>
        <div style={{
          border: '4px solid var(--app-border)',
          borderTop: '4px solid var(--bm-accent)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{marginTop: '20px', fontSize: '18px'}}>Loading Business Manager...</p>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return (
      <>
        <Dashboard />
        <NotificationToast />
      </>
    );
  } else {
    return <OfflineLoginPage />;
  }
};

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <CurrencyProvider>
          <LabelProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </LabelProvider>
        </CurrencyProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
