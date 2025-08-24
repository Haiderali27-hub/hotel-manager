# Theme System Implementation Guide

## Overview
The hotel management application now includes a comprehensive dark/light theme system that can be easily applied to all components, including future screens.

## How to Use

### 1. Import the Theme Hook
```tsx
import { useTheme } from '../context/ThemeContext';
```

### 2. Use in Components
```tsx
const MyComponent: React.FC = () => {
  const { colors, theme, toggleTheme } = useTheme();
  
  return (
    <div style={{
      backgroundColor: colors.primary,
      color: colors.text
    }}>
      {/* Your component content */}
    </div>
  );
};
```

## Available Theme Colors

### Background Colors
- `colors.primary` - Main background color
- `colors.secondary` - Secondary background (sidebars, headers)
- `colors.surface` - Form inputs, cards
- `colors.card` - Card backgrounds

### Text Colors
- `colors.text` - Primary text color
- `colors.textSecondary` - Secondary text
- `colors.textMuted` - Muted/disabled text

### Border Colors
- `colors.border` - Main border color
- `colors.borderLight` - Light borders

### Interactive Colors
- `colors.accent` - Brand accent color (#F59E0B)
- `colors.accentHover` - Hover state for accent
- `colors.success` - Success color
- `colors.error` - Error color
- `colors.warning` - Warning color

### Status Colors
- `colors.successBg` - Success background
- `colors.errorBg` - Error background
- `colors.warningBg` - Warning background
- `colors.infoBg` - Info background

### Special Colors
- `colors.shadow` - Box shadow color
- `colors.overlay` - Modal overlay color

## Gradient Colors
For gradient cards and decorative elements:

```tsx
import { getGradientColors } from '../context/ThemeContext';

const MyComponent: React.FC = () => {
  const { theme } = useTheme();
  const gradients = getGradientColors(theme);
  
  return (
    <div style={{
      background: gradients.primary
    }}>
      Statistics Card
    </div>
  );
};
```

Available gradients:
- `gradients.primary`
- `gradients.success`
- `gradients.error`
- `gradients.warning`
- `gradients.accent`
- `gradients.info`

## Theme Toggle Button
Add a theme toggle button to any component:

```tsx
const { theme, toggleTheme } = useTheme();

<button
  onClick={toggleTheme}
  style={{
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    padding: '0.5rem',
    borderRadius: '6px',
    cursor: 'pointer'
  }}
  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>
```

## Common Component Patterns

### Form Elements
```tsx
// Input field
<input
  style={{
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    padding: '0.75rem',
    borderRadius: '6px'
  }}
/>

// Button
<button
  style={{
    backgroundColor: colors.accent,
    color: theme === 'dark' ? '#000' : '#FFFFFF',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer'
  }}
>
  Submit
</button>
```

### Cards and Containers
```tsx
<div style={{
  backgroundColor: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: `0 2px 4px ${colors.shadow}`
}}>
  Card content
</div>
```

### Error/Success Messages
```tsx
// Error message
<div style={{
  backgroundColor: colors.errorBg,
  border: `1px solid ${colors.error}`,
  borderRadius: '6px',
  padding: '1rem',
  color: colors.error
}}>
  Error message
</div>

// Success message
<div style={{
  backgroundColor: colors.successBg,
  border: `1px solid ${colors.success}`,
  borderRadius: '6px',
  padding: '1rem',
  color: colors.success
}}>
  Success message
</div>
```

## Applied Components
✅ **Dashboard** - Fully themed with toggle button
✅ **AddGuest** - Form and container themed
✅ **AddFoodOrder** - Container themed
✅ **ThemeProvider** - Setup in App.tsx

## Future Implementation
For new components:

1. Import `useTheme` hook
2. Destructure `colors` and `theme`
3. Apply colors to all style objects
4. Use gradients for decorative elements
5. Add theme toggle button where appropriate

## Theme Persistence
The theme preference is automatically saved to localStorage and restored on app reload.

## Benefits
- ✅ Consistent visual experience
- ✅ User preference persistence
- ✅ Easy to maintain and extend
- ✅ Accessibility-friendly
- ✅ Professional appearance in both themes
- ✅ Future-proof for new features
