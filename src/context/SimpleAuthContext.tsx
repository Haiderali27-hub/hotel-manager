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
    setIsLoading(false);
    
    console.log('AuthProvider initialized - user logged out');
  }, []);

  const login = async (request: LoginRequest): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Login attempt for username:', request.username);
      
      // Simple authentication check
      if (request.username === 'admin' && request.password === 'admin123') {
        console.log('Login successful');
        
        setIsAuthenticated(true);
        setAdminId(1);
        
        // Optional: Set session data for future use
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiryTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const currentTime = new Date().toISOString();
        
        localStorage.setItem('hotel_session_token', sessionToken);
        localStorage.setItem('hotel_session_expiry', expiryTime.toISOString());
        localStorage.setItem('hotel_last_activity', currentTime);
        
        return { 
          success: true, 
          message: 'Login successful' 
        };
      } else {
        console.log('Login failed - invalid credentials');
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
      if (username === 'admin') {
        return {
          success: true,
          question: 'What is your favorite hotel chain?',
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
      if (username === 'admin' && securityAnswer.toLowerCase() === 'hilton') {
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

  console.log('AuthProvider rendering with state:', { isAuthenticated, isLoading, adminId });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
