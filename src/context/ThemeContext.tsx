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
  // Background colors
  primary: 'var(--app-bg)',
  secondary: 'var(--app-surface)',
  surface: 'var(--app-surface)',
  card: 'var(--app-surface)',
  
  // Text colors
  text: 'var(--app-text)',
  textSecondary: 'var(--app-text)',
  textMuted: 'var(--app-text-muted)',
  
  // Border colors
  border: 'var(--app-border)',
  borderLight: 'var(--app-border)',
  
  // Interactive colors
  accent: 'var(--bm-accent)',
  accentHover: 'var(--bm-accent-soft)',
  success: 'var(--bm-primary)',
  error: 'var(--bm-accent)',
  warning: 'var(--bm-accent-soft)',
  
  // Status colors
  successBg: 'rgba(43, 87, 109, 0.12)',
  errorBg: 'rgba(221, 159, 82, 0.12)',
  warningBg: 'rgba(220, 200, 148, 0.18)',
  infoBg: 'rgba(141, 161, 175, 0.18)',
  
  // Special colors
  shadow: 'var(--bm-primary-shadow)',
  overlay: 'rgba(43, 87, 109, 0.55)'
};

const darkTheme: ThemeColors = {
  // Background colors
  primary: 'var(--bm-primary)',
  secondary: 'var(--bm-primary-alt)',
  surface: 'rgba(255, 255, 255, 0.06)',
  card: 'rgba(255, 255, 255, 0.08)',
  
  // Text colors
  text: 'white',
  textSecondary: 'rgba(255, 255, 255, 0.9)',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  
  // Border colors
  border: 'rgba(255, 255, 255, 0.14)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  
  // Interactive colors
  accent: 'var(--bm-accent)',
  accentHover: 'var(--bm-accent-soft)',
  success: 'var(--bm-accent-soft)',
  error: 'var(--bm-accent)',
  warning: 'var(--bm-accent-soft)',
  
  // Status colors
  successBg: 'rgba(220, 200, 148, 0.14)',
  errorBg: 'rgba(221, 159, 82, 0.16)',
  warningBg: 'rgba(220, 200, 148, 0.14)',
  infoBg: 'rgba(141, 161, 175, 0.16)',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.35)',
  overlay: 'rgba(0, 0, 0, 0.65)'
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
  return {
    primary: 'linear-gradient(135deg, var(--bm-primary), var(--bm-muted))',
    success: 'linear-gradient(135deg, var(--bm-primary), var(--bm-primary-alt))',
    error: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    warning: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    accent: 'linear-gradient(135deg, var(--bm-accent), var(--bm-accent-soft))',
    info: 'linear-gradient(135deg, var(--bm-muted), var(--bm-light))'
  };
};
