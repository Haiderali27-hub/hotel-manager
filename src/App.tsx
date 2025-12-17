import React from 'react';
import './App.css';

import Dashboard from './components/Dashboard';
import NotificationToast from './components/NotificationToast';
import OfflineLoginPage from './components/OfflineLoginPage';
import { CurrencyProvider } from './context/CurrencyContext';
import { LabelProvider } from './context/LabelContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/SimpleAuthContext';
import { ThemeProvider } from './context/ThemeContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('🔍 App State:', { isAuthenticated, isLoading });

  if (isLoading) {
    console.log('⏳ Showing loading spinner');
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

  console.log('📱 Showing main content, authenticated:', isAuthenticated);
  
  if (isAuthenticated) {
    console.log('✅ User is authenticated - showing Dashboard');
    return (
      <>
        <Dashboard />
        <NotificationToast />
      </>
    );
  } else {
    console.log('❌ User not authenticated - showing Login Page');
    return <OfflineLoginPage />;
  }
};

function App() {
  console.log('🚀 App component rendering');
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
