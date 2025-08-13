import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
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

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState<number | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      
      const isValid = await authService.validateSession();
      setIsAuthenticated(isValid);
      
      if (isValid) {
        setAdminId(authService.getAdminId());
      }
      
      setIsLoading(false);
    };

    checkAuthStatus();

    // Cleanup expired sessions periodically
    const interval = setInterval(() => {
      authService.cleanupSessions();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authService.login(username, password);
    
    if (response.success) {
      setIsAuthenticated(true);
      setAdminId(authService.getAdminId());
    }
    
    return {
      success: response.success,
      message: response.message,
    };
  };

  const logout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setAdminId(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
    adminId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
