import React, { createContext, useContext, useEffect, useState } from 'react';

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (request: LoginRequest) => Promise<{ 
    success: boolean; 
    message: string; 
  }>;
  logout: () => Promise<void>;
  getSecurityQuestion: (username: string) => Promise<{ success: boolean; question?: string; message: string }>;
  resetPassword: (username: string, securityAnswer: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  adminId: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState<number | null>(null);

  // Check if user is already authenticated on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const sessionToken = localStorage.getItem('hotel_session_token');
        const sessionExpiry = localStorage.getItem('hotel_session_expiry');
        const lastActivity = localStorage.getItem('hotel_last_activity');
        
        console.log('Checking auth status:', { sessionToken: !!sessionToken, sessionExpiry: !!sessionExpiry, lastActivity: !!lastActivity });
        
        if (sessionToken && sessionExpiry && lastActivity) {
          const expiryTime = new Date(sessionExpiry).getTime();
          const currentTime = new Date().getTime();
          const lastActivityTime = new Date(lastActivity).getTime();
          
          // Check if session is still valid and was active recently (within 5 minutes)
          const fiveMinutesAgo = currentTime - (5 * 60 * 1000);
          
          if (currentTime < expiryTime && lastActivityTime > fiveMinutesAgo) {
            console.log('Session is valid, setting authenticated');
            setIsAuthenticated(true);
            setAdminId(1);
            // Update last activity to current time
            localStorage.setItem('hotel_last_activity', new Date().toISOString());
          } else {
            // Session expired or too much time passed since last activity
            console.log('Session invalid - clearing data');
            localStorage.removeItem('hotel_session_token');
            localStorage.removeItem('hotel_session_expiry');
            localStorage.removeItem('hotel_last_activity');
            setIsAuthenticated(false);
            setAdminId(null);
          }
        } else {
          // No session data found
          console.log('No session data found - user not authenticated');
          setIsAuthenticated(false);
          setAdminId(null);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
        setAdminId(null);
      } finally {
        console.log('Setting loading to false');
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Auto-logout on window close/refresh for security
  useEffect(() => {
    const handleBeforeUnload = async (_event: BeforeUnloadEvent) => {
      // Clear session when window is closed
      if (isAuthenticated) {
        localStorage.removeItem('hotel_session_token');
        localStorage.removeItem('hotel_session_expiry');
        localStorage.removeItem('hotel_last_activity');
        
        // In a real Tauri app, call the logout backend function
        // await logout_admin(sessionToken);
        
        console.log('Auto-logout: Session cleared on window close');
      }
    };

    const handleVisibilityChange = () => {
      // Additional security: logout when app loses focus for extended time
      if (document.hidden && isAuthenticated) {
        // Set a timer to auto-logout after 5 minutes of inactivity
        const inactivityTimer = setTimeout(() => {
          if (document.hidden && isAuthenticated) {
            console.log('Auto-logout: Session cleared due to inactivity');
            logout();
          }
        }, 5 * 60 * 1000); // 5 minutes

        // Clear timer if user returns to app
        const clearTimer = () => {
          clearTimeout(inactivityTimer);
          document.removeEventListener('visibilitychange', clearTimer);
        };
        
        document.addEventListener('visibilitychange', clearTimer);
      }
    };

    // Add event listeners for auto-logout
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  const login = async (request: LoginRequest): Promise<{ success: boolean; message: string }> => {
    try {
      // Mock authentication - in real app, this would call Tauri command
      // Default credentials: yasinheaven / YHSHotel@2025!
      if (request.username === 'yasinheaven' && request.password === 'YHSHotel@2025!') {
        // Create session
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiryTime = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
        const currentTime = new Date().toISOString();
        
        localStorage.setItem('hotel_session_token', sessionToken);
        localStorage.setItem('hotel_session_expiry', expiryTime.toISOString());
        localStorage.setItem('hotel_last_activity', currentTime);
        
        setIsAuthenticated(true);
        setAdminId(1);
        
        return { 
          success: true, 
          message: 'Login successful' 
        };
      } else {
        return { 
          success: false, 
          message: 'Invalid username or password' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: 'An error occurred during login' 
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Clear session storage
      localStorage.removeItem('hotel_session_token');
      localStorage.removeItem('hotel_session_expiry');
      localStorage.removeItem('hotel_last_activity');
      
      setIsAuthenticated(false);
      setAdminId(null);
      
      console.log('Logout completed - all session data cleared');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getSecurityQuestion = async (username: string): Promise<{ success: boolean; question?: string; message: string }> => {
    try {
      // Mock security question - in real app, this would call Tauri command
      if (username === 'yasinheaven') {
        return {
          success: true,
          question: 'What is the name of your village?',
          message: 'Security question retrieved successfully'
        };
      } else {
        return {
          success: false,
          message: 'Username not found'
        };
      }
    } catch (error) {
      console.error('Get security question error:', error);
      return {
        success: false,
        message: 'Error retrieving security question'
      };
    }
  };

  const resetPassword = async (username: string, securityAnswer: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Mock password reset - in real app, this would call Tauri command
      if (username === 'yasinheaven' && securityAnswer.toLowerCase() === 'center yasin') {
        // In a real app, you would update the password in the database here
        console.log(`Password reset for ${username} with new password: ${newPassword}`);
        
        return {
          success: true,
          message: 'Password reset successfully'
        };
      } else {
        return {
          success: false,
          message: 'Incorrect security answer'
        };
      }
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        message: 'Error resetting password'
      };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Mock password change - in real app, this would call Tauri command
      if (currentPassword === 'admin123') {
        console.log(`Password changed to: ${newPassword}`);
        return {
          success: true,
          message: 'Password changed successfully'
        };
      } else {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: 'Error changing password'
      };
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
    getSecurityQuestion,
    resetPassword,
    changePassword,
    adminId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
