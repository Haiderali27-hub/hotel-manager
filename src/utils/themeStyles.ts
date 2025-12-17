import type { ThemeColors } from '../context/ThemeContext';

/**
 * Utility functions for theme-aware styling
 */

export interface ThemeStyleProps {
  colors: ThemeColors;
  theme: 'light' | 'dark';
}

/**
 * Common button styles with theme support
 */
export const getButtonStyles = ({ colors, theme }: ThemeStyleProps) => ({
  primary: {
    backgroundColor: colors.accent,
    color: theme === 'dark' ? 'black' : 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500' as const,
    transition: 'all 0.2s ease'
  },
  secondary: {
    backgroundColor: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500' as const,
    transition: 'all 0.2s ease'
  },
  danger: {
    backgroundColor: colors.error,
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500' as const,
    transition: 'all 0.2s ease'
  },
  success: {
    backgroundColor: colors.success,
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500' as const,
    transition: 'all 0.2s ease'
  }
});

/**
 * Common input field styles with theme support
 */
export const getInputStyles = ({ colors }: ThemeStyleProps) => ({
  default: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.text,
    fontSize: '1rem',
    transition: 'border-color 0.2s ease',
    outline: 'none'
  }
});

/**
 * Common card styles with theme support
 */
export const getCardStyles = ({ colors }: ThemeStyleProps) => ({
  default: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: `0 2px 4px ${colors.shadow}`,
    transition: 'box-shadow 0.2s ease'
  },
  elevated: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: `0 4px 12px ${colors.shadow}`,
    transition: 'box-shadow 0.2s ease'
  }
});

/**
 * Common container styles with theme support
 */
export const getContainerStyles = ({ colors }: ThemeStyleProps) => ({
  page: {
    padding: '2rem',
    backgroundColor: colors.primary,
    color: colors.text,
    minHeight: '100vh'
  },
  section: {
    backgroundColor: colors.secondary,
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem'
  }
});

/**
 * Status message styles with theme support
 */
export const getStatusStyles = ({ colors }: ThemeStyleProps) => ({
  success: {
    backgroundColor: colors.successBg,
    border: `1px solid ${colors.success}`,
    borderRadius: '6px',
    padding: '1rem',
    color: colors.success,
    marginTop: '1rem'
  },
  error: {
    backgroundColor: colors.errorBg,
    border: `1px solid ${colors.error}`,
    borderRadius: '6px',
    padding: '1rem',
    color: colors.error,
    marginTop: '1rem'
  },
  warning: {
    backgroundColor: colors.warningBg,
    border: `1px solid ${colors.warning}`,
    borderRadius: '6px',
    padding: '1rem',
    color: colors.warning,
    marginTop: '1rem'
  },
  info: {
    backgroundColor: colors.infoBg,
    border: `1px solid ${colors.accent}`,
    borderRadius: '6px',
    padding: '1rem',
    color: colors.accent,
    marginTop: '1rem'
  }
});

/**
 * Navigation styles with theme support
 */
export const getNavigationStyles = ({ colors }: ThemeStyleProps) => ({
  sidebar: {
    backgroundColor: colors.secondary,
    borderRight: `1px solid ${colors.border}`,
    transition: 'width 0.3s ease'
  },
  navItem: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '1rem',
    padding: '1rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.text,
    fontSize: '1rem',
    cursor: 'pointer',
    borderRadius: '8px',
    width: '100%',
    textAlign: 'left' as const,
    marginBottom: '0.5rem',
    transition: 'background-color 0.2s'
  },
  header: {
    backgroundColor: colors.secondary,
    borderBottom: `1px solid ${colors.border}`,
    padding: '1rem 2rem',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const
  }
});

/**
 * Form styles with theme support
 */
export const getFormStyles = ({ colors }: ThemeStyleProps) => ({
  label: {
    display: 'block' as const,
    marginBottom: '0.5rem',
    fontWeight: '500' as const,
    color: colors.text
  },
  fieldContainer: {
    marginBottom: '1.5rem'
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.text,
    fontSize: '1rem',
    cursor: 'pointer'
  }
});

/**
 * Modal styles with theme support
 */
export const getModalStyles = ({ colors }: ThemeStyleProps) => ({
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1000
  },
  content: {
    backgroundColor: colors.card,
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: `0 8px 32px ${colors.shadow}`,
    border: `1px solid ${colors.border}`,
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90%',
    overflow: 'auto'
  }
});

/**
 * Table styles with theme support
 */
export const getTableStyles = ({ colors }: ThemeStyleProps) => ({
  container: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: colors.secondary,
    padding: '1rem',
    fontWeight: '600' as const,
    color: colors.text,
    borderBottom: `1px solid ${colors.border}`
  },
  row: {
    padding: '1rem',
    borderBottom: `1px solid ${colors.borderLight}`,
    color: colors.text,
    transition: 'background-color 0.2s'
  },
  cell: {
    padding: '0.5rem',
    color: colors.text
  }
});
