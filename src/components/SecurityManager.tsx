import React, { useEffect } from 'react';
import { useAuth } from '../context/SimpleAuthContext';

interface SecurityManagerProps {
  children: React.ReactNode;
}

const SecurityManager: React.FC<SecurityManagerProps> = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let warningTimer: ReturnType<typeof setTimeout> | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (warningTimer) clearTimeout(warningTimer);

      if (isAuthenticated) {
        // Show warning after 25 minutes of inactivity
        warningTimer = setTimeout(() => {
          const shouldStayLoggedIn = window.confirm(
            'You have been inactive for 25 minutes. Click OK to stay logged in, or Cancel to logout for security.'
          );
          
          if (!shouldStayLoggedIn) {
            logout();
            alert('You have been logged out for security reasons.');
          } else {
            resetInactivityTimer(); // Reset timer if user wants to stay logged in
          }
        }, 25 * 60 * 1000); // 25 minutes

        // Auto-logout after 30 minutes of inactivity
        inactivityTimer = setTimeout(() => {
          logout();
          alert('You have been automatically logged out due to inactivity.');
        }, 30 * 60 * 1000); // 30 minutes
      }
    };

    const handleActivity = () => {
      if (isAuthenticated) {
        // Update last activity timestamp
        localStorage.setItem('hotel_last_activity', new Date().toISOString());
      }
      resetInactivityTimer();
    };

    const handleAppClose = () => {
      if (isAuthenticated) {
        // Clear session data on app close
        localStorage.removeItem('hotel_session_token');
        localStorage.removeItem('hotel_session_expiry');
        localStorage.removeItem('hotel_last_activity');
        console.log('Security: Session cleared on app close');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isAuthenticated) {
        // App went to background - start security timer
        console.log('App hidden - starting security timer');
      } else if (!document.hidden && isAuthenticated) {
        // App came to foreground - reset activity timer
        resetInactivityTimer();
      }
    };

    // Add event listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleAppClose);

    // Initialize timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (warningTimer) clearTimeout(warningTimer);
      
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleAppClose);
    };
  }, [isAuthenticated, logout]);

  return <>{children}</>;
};

export default SecurityManager;
