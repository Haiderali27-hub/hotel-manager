import React, { useEffect, useState } from 'react';
import './App.css';

import LicenseGate from './components/LicenseGate';
import SetupWizard from './components/SetupWizard';
import UpdateChecker from './components/UpdateChecker';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { LabelProvider, useLabels } from './context/LabelContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import CafeModuleHome from './modules/cafe/components/CafeModuleHome';
import HotelRestaurantDashboard from './modules/hotel_restaurant/components/HotelRestaurantDashboard';
import ModernDashboard from './modules/retail/components/ModernDashboard';
import NotificationToast from './modules/retail/components/NotificationToast';
import OfflineLoginPage from './modules/retail/components/OfflineLoginPage';
import SalonModuleHome from './modules/salon/components/SalonModuleHome';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { mode } = useLabels();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (isAuthenticated && !isLoading) {
        try {
          // User is authenticated, we don't need setup wizard on subsequent logins
          setShowSetupWizard(false);
        } catch (error) {
          console.error('Failed to check setup status:', error);
          setShowSetupWizard(false);
        } finally {
          setCheckingSetup(false);
        }
      } else {
        setCheckingSetup(false);
      }
    };
    
    checkSetupStatus();
  }, [isAuthenticated, isLoading]);

  if (isLoading || checkingSetup) {
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
        <p style={{marginTop: '20px', fontSize: '18px'}}>Loading INERTIA...</p>
      </div>
    );
  }
  
  if (isAuthenticated) {
    const dashboard =
      mode === 'hotel' || mode === 'restaurant'
        ? <HotelRestaurantDashboard />
        : mode === 'salon'
          ? <SalonModuleHome />
          : mode === 'cafe'
            ? <CafeModuleHome />
            : <ModernDashboard />;

    return (
      <LicenseGate>
        <UpdateChecker />
        {showSetupWizard && <SetupWizard onComplete={() => setShowSetupWizard(false)} />}
        {dashboard}
        <NotificationToast />
      </LicenseGate>
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
