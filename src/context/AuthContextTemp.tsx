import React, { createContext, useContext, useEffect, useState } from 'react';

interface LoginRequest {
  username: string;
  password: string;
  otp?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresOTP: boolean;
  otpSent: boolean;
  login: (request: LoginRequest) => Promise<{ 
    success: boolean; 
    message: string; 
    requires_otp?: boolean;
    otp_sent?: boolean;
  }>;
  logout: () => Promise<void>;
  generateOTP: (username: string) => Promise<{ success: boolean; message: string; otp?: string }>;
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

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresOTP, setRequiresOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [adminId, setAdminId] = useState<number | null>(null);
  const [currentOTP, setCurrentOTP] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const login = async (request: LoginRequest) => {
    // Mock validation for demo
    if (request.username === 'admin' && request.password === 'hotel123') {
      
      if (!request.otp) {
        // Password is correct, but OTP is required
        setRequiresOTP(true);
        setOtpSent(false);
        return {
          success: false,
          message: 'OTP required for login',
          requires_otp: true,
          otp_sent: false,
        };
      } else {
        // Check OTP
        if (request.otp === currentOTP) {
          setIsAuthenticated(true);
          setAdminId(1);
          setRequiresOTP(false);
          setOtpSent(false);
          setCurrentOTP(null);
          return {
            success: true,
            message: 'Login successful',
          };
        } else {
          return {
            success: false,
            message: 'Invalid OTP',
            requires_otp: true,
            otp_sent: true,
          };
        }
      }
    } else {
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }
  };

  const generateOTP = async (username: string) => {
    if (username === 'admin') {
      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setCurrentOTP(otp);
      setOtpSent(true);
      
      // In a real offline system, this would be displayed to the user
      // For demo, we'll show it in the response
      return {
        success: true,
        message: 'OTP generated successfully',
        otp: otp, // In offline mode, show OTP directly
      };
    } else {
      return {
        success: false,
        message: 'User not found',
      };
    }
  };

  const getSecurityQuestion = async (username: string) => {
    if (username === 'admin') {
      return {
        success: true,
        question: 'What is the default role of the first user?',
        message: 'Security question retrieved',
      };
    } else {
      return {
        success: false,
        message: 'User not found',
      };
    }
  };

  const resetPassword = async (username: string, securityAnswer: string, newPassword: string) => {
    if (username === 'admin' && securityAnswer.toLowerCase() === 'manager') {
      console.log('Password would be reset to:', newPassword);
      return {
        success: true,
        message: 'Password reset successfully',
      };
    } else {
      return {
        success: false,
        message: 'Invalid username or security answer',
      };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (currentPassword === 'hotel123') {
      console.log('Password would be changed to:', newPassword);
      return {
        success: true,
        message: 'Password changed successfully',
      };
    } else {
      return {
        success: false,
        message: 'Current password is incorrect',
      };
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setAdminId(null);
    setRequiresOTP(false);
    setOtpSent(false);
    setCurrentOTP(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    requiresOTP,
    otpSent,
    login,
    logout,
    generateOTP,
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
