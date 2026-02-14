/* eslint-disable react-refresh/only-export-components */
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
  // Background colors - New Blue Palette
  primary: '#ffffff',
  secondary: '#C1E8FF',
  surface: '#ffffff',
  card: '#ffffff',
  
  // Text colors
  text: '#021024',
  textSecondary: '#052659',
  textMuted: '#5483B3',
  
  // Border colors
  border: '#7DA0CA',
  borderLight: '#C1E8FF',
  
  // Interactive colors
  accent: '#5483B3',
  accentHover: '#7DA0CA',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  
  // Status colors
  successBg: 'rgba(22, 163, 74, 0.12)',
  errorBg: 'rgba(220, 38, 38, 0.12)',
  warningBg: 'rgba(217, 119, 6, 0.12)',
  infoBg: 'rgba(84, 131, 179, 0.12)',
  
  // Special colors
  shadow: 'rgba(2, 16, 36, 0.18)',
  overlay: 'rgba(2, 16, 36, 0.55)'
};

const darkTheme: ThemeColors = {
  // Background colors - New Blue Palette
  primary: '#021024',
  secondary: '#052659',
  surface: '#052659',
  card: '#052659',
  
  // Text colors
  text: '#C1E8FF',
  textSecondary: '#7DA0CA',
  textMuted: '#5483B3',
  
  // Border colors
  border: '#5483B3',
  borderLight: '#052659',
  
  // Interactive colors
  accent: '#5483B3',
  accentHover: '#7DA0CA',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  
  // Status colors
  successBg: 'rgba(34, 197, 94, 0.16)',
  errorBg: 'rgba(239, 68, 68, 0.16)',
  warningBg: 'rgba(245, 158, 11, 0.16)',
  infoBg: 'rgba(84, 131, 179, 0.16)',
  
  // Special colors
  shadow: 'rgba(0, 0, 0, 0.45)',
  overlay: 'rgba(2, 16, 36, 0.8)'
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

  // NOTE: Primary color customization has been disabled per architectural decision.
  // The Inertia branding and theme colors remain fixed - business logos are shown separately.
  // This useEffect is kept commented out for backward compatibility reference only.
  /*
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
  */

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
