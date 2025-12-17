import { invoke } from '@tauri-apps/api/core';
import React, { createContext, useContext, useEffect, useState } from 'react';
import SetupWizard from '../components/SetupWizard';

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
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  // Simple initialization - always start with logout state
  useEffect(() => {
    console.log('AuthProvider initializing...');
    
    // Clear any existing session data to ensure fresh start
    localStorage.removeItem('hotel_session_token');
    localStorage.removeItem('hotel_session_expiry');
    localStorage.removeItem('hotel_last_activity');
    
    // Set initial state
    setIsAuthenticated(false);
    setAdminId(null);

    async function checkSetupStatus() {
      try {
        const setup = await invoke<boolean>('check_is_setup');
        setIsSetupComplete(setup);
      } catch (e) {
        console.error('Failed to check setup status:', e);
        // Don't unlock the app if the backend/db check fails.
        // Default to showing setup (it will surface a clear error if backend is truly unavailable).
        setIsSetupComplete(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSetupStatus();

    console.log('AuthProvider initialized - user logged out');
  }, []);

  const login = async (request: LoginRequest): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Login attempt for username:', request.username);
      
      const result = await invoke('login_admin', {
        request: {
          username: request.username,
          password: request.password
        }
      }) as { success: boolean; message: string; session_token?: string };

      if (result.success) {
        console.log('Tauri backend login successful');
        setIsAuthenticated(true);
        setAdminId(1);

        if (result.session_token) {
          const expiryTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
          const currentTime = new Date().toISOString();

          localStorage.setItem('hotel_session_token', result.session_token);
          localStorage.setItem('hotel_session_expiry', expiryTime.toISOString());
          localStorage.setItem('hotel_last_activity', currentTime);
        }

        return {
          success: true,
          message: result.message || 'Login successful'
        };
      }

      return {
        success: false,
        message: result.message || 'Invalid credentials'
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: typeof error === 'string' ? error : 'An error occurred during login'
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('Logging out...');
      
      // Clear all session data
      localStorage.removeItem('hotel_session_token');
      localStorage.removeItem('hotel_session_expiry');
      localStorage.removeItem('hotel_last_activity');
      
      setIsAuthenticated(false);
      setAdminId(null);
      
      console.log('Logout completed');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getSecurityQuestion = async (username: string): Promise<{ success: boolean; question?: string; message: string }> => {
    try {
      const result = await invoke('get_security_question', {
        username: username
      }) as { success: boolean; question?: string; message: string };

      console.log('Tauri getSecurityQuestion result:', result);
      return result;
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
      const result = await invoke('reset_admin_password', {
        request: {
          username: username,
          security_answer: securityAnswer,
          new_password: newPassword
        }
      }) as { success: boolean; message: string };

      console.log('Tauri resetPassword result:', result);
      return result;
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
      void currentPassword;
      void newPassword;
      return {
        success: false,
        message: 'Use the password reset flow to change password.'
      };
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

  console.log('AuthProvider rendering with state:', { isAuthenticated, isLoading, adminId });

  return (
    <AuthContext.Provider value={value}>
      {isSetupComplete === false && !isLoading ? (
        <SetupWizard onComplete={() => setIsSetupComplete(true)} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
