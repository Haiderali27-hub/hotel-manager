import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeType = 'light' | 'dark';

export interface ThemeColors {
  // Background colors
  primary: string;
  secondary: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Interactive colors
  accent: string;
  accentHover: string;
  success: string;
  error: string;
  warning: string;
  
  // Status colors
  successBg: string;
  errorBg: string;
  warningBg: string;
  infoBg: string;
  
  // Special colors
  shadow: string;
  overlay: string;
}

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const lightTheme: ThemeColors = {
  // Background colors
  primary: '#FFFFFF',
  secondary: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  
  // Text colors
  text: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  
  // Border colors
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // Interactive colors
  accent: '#F59E0B',
  accentHover: '#D97706',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  
  // Status colors
  successBg: '#ECFDF5',
  errorBg: '#FEE2E2',
  warningBg: '#FEF3C7',
  infoBg: '#EFF6FF',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)'
};

const darkTheme: ThemeColors = {
  // Background colors
  primary: '#1E1E2E',
  secondary: '#2D2D44',
  surface: '#3D3D5C',
  card: '#2D2D44',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  
  // Border colors
  border: '#3D3D5C',
  borderLight: '#4B5563',
  
  // Interactive colors
  accent: '#F59E0B',
  accentHover: '#D97706',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  
  // Status colors
  successBg: '#064E3B',
  errorBg: '#7F1D1D',
  warningBg: '#78350F',
  infoBg: '#1E3A8A',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('light');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('hotel-app-theme') as ThemeType;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('hotel-app-theme', theme);
    // Set data-theme attribute on document for CSS styling
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const colors = theme === 'light' ? lightTheme : darkTheme;

  const value: ThemeContextType = {
    theme,
    colors,
    toggleTheme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Utility function to get theme-aware gradient colors
export const getGradientColors = (theme: ThemeType) => {
  return {
    primary: theme === 'light' 
      ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
      : 'linear-gradient(135deg, #60A5FA, #3B82F6)',
    success: theme === 'light'
      ? 'linear-gradient(135deg, #22C55E, #16A34A)'
      : 'linear-gradient(135deg, #34D399, #22C55E)',
    error: theme === 'light'
      ? 'linear-gradient(135deg, #EF4444, #DC2626)'
      : 'linear-gradient(135deg, #F87171, #EF4444)',
    warning: theme === 'light'
      ? 'linear-gradient(135deg, #F59E0B, #D97706)'
      : 'linear-gradient(135deg, #FBBF24, #F59E0B)',
    accent: theme === 'light'
      ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
      : 'linear-gradient(135deg, #A78BFA, #8B5CF6)',
    info: theme === 'light'
      ? 'linear-gradient(135deg, #10B981, #059669)'
      : 'linear-gradient(135deg, #34D399, #10B981)'
  };
};
