/* eslint-disable react-refresh/only-export-components */
import { invoke } from '@tauri-apps/api/core';
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
  // Background colors - BizCore Phase 4 Light Palette
  primary: '#fdfdfd',
  secondary: '#e8eaec',
  surface: '#e8eaec',
  card: '#e8eaec',
  
  // Text colors
  text: '#845c58',
  textSecondary: '#8892a9',
  textMuted: '#8892a9',
  
  // Border colors
  border: '#d2d6db',
  borderLight: '#e8eaec',
  
  // Interactive colors
  accent: '#845c58',
  accentHover: '#845c58',
  success: '#845c58',
  error: '#845c58',
  warning: '#8892a9',
  
  // Status colors
  successBg: 'rgba(132, 92, 88, 0.1)',
  errorBg: 'rgba(132, 92, 88, 0.1)',
  warningBg: 'rgba(183, 186, 195, 0.15)',
  infoBg: 'rgba(136, 146, 169, 0.1)',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.55)'
};

const darkTheme: ThemeColors = {
  // Background colors - BizCore Phase 4 Dark Palette
  primary: '#0b0b0b',
  secondary: '#1e1e1f',
  surface: '#1e1e1f',
  card: '#1e1e1f',
  
  // Text colors
  text: '#cdd0dc',
  textSecondary: '#958f9e',
  textMuted: '#958f9e',
  
  // Border colors
  border: '#393741',
  borderLight: '#1e1e1f',
  
  // Interactive colors
  accent: '#665f5f',
  accentHover: '#665f5f',
  success: '#665f5f',
  error: '#665f5f',
  warning: '#958f9e',
  
  // Status colors
  successBg: 'rgba(102, 95, 95, 0.15)',
  errorBg: 'rgba(149, 143, 158, 0.15)',
  warningBg: 'rgba(102, 95, 95, 0.15)',
  infoBg: 'rgba(205, 208, 220, 0.1)',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.45)',
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
    const savedTheme = localStorage.getItem('bm-app-theme') as ThemeType;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setTheme(savedTheme);
      return;
    }

    // Migrate legacy theme key
    const legacyTheme = localStorage.getItem('hotel-app-theme') as ThemeType;
    if (legacyTheme && (legacyTheme === 'light' || legacyTheme === 'dark')) {
      localStorage.setItem('bm-app-theme', legacyTheme);
      localStorage.removeItem('hotel-app-theme');
      setTheme(legacyTheme);
    }
  }, []);

  useEffect(() => {
    const applyBrandPrimaryColor = async () => {
      try {
        const savedPrimary = await invoke<string | null>('get_primary_color');
        if (!savedPrimary) return;

        const normalized = savedPrimary.startsWith('#') ? savedPrimary : `#${savedPrimary}`;
        document.documentElement.style.setProperty('--primary-color', normalized);
        // Existing theme tokens across the app.
        document.documentElement.style.setProperty('--bm-primary', normalized);
        document.documentElement.style.setProperty('--bm-primary-alt', normalized);
      } catch {
        // Branding is optional; ignore if backend isn't available.
      }
    };

    applyBrandPrimaryColor();
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('bm-app-theme', theme);
    localStorage.removeItem('hotel-app-theme');
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
export const getGradientColors = (_theme: ThemeType) => {
  void _theme;
  return {
    primary: 'linear-gradient(135deg, var(--bm-primary), var(--bm-muted))',
    success: 'linear-gradient(135deg, var(--bm-primary), var(--bm-primary-alt))',
    error: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    warning: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    accent: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    info: 'linear-gradient(135deg, var(--bm-muted), var(--bm-light))'
  };
};
