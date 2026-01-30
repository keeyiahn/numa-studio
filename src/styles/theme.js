// Design tokens and theme constants

export const colors = {
  // Primary colors
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#dbeafe',
  
  // Success colors
  success: '#10b981',
  successHover: '#059669',
  
  // Neutral colors
  bg: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    hover: '#f8fafc',
  },
  
  // Text colors
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#64748b',
    muted: '#94a3b8',
  },
  
  // Border colors
  border: {
    default: '#e2e8f0',
    light: '#f1f5f9',
    dark: '#cbd5e1',
  },
  
  // Danger/error colors
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  dangerBorder: '#fecaca',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '32px',
};

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
};

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 1px 2px rgba(0, 0, 0, 0.05)',
  lg: '0 2px 4px rgba(0, 0, 0, 0.08)',
  xl: '0 2px 4px rgba(0, 0, 0, 0.1)',
  '2xl': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  '3xl': '0 4px 6px rgba(59, 130, 246, 0.3)',
  '4xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
};

export const typography = {
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    light: '300',
  },
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.05em',
  },
};

export const transitions = {
  default: 'all 0.2s ease',
  transform: 'transform 0.2s ease',
  colors: 'background-color 0.2s ease, color 0.2s ease',
};
