import { colors, spacing, borderRadius, shadows, typography, transitions } from './theme';

// Button styles
export const buttonStyles = {
  primary: {
    padding: '10px 20px',
    background: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.default,
    boxShadow: shadows.md,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
  },
  
  primaryHover: {
    background: colors.primaryHover,
    transform: 'translateY(-1px)',
    boxShadow: shadows['3xl'],
  },
  
  secondary: {
    padding: '10px 20px',
    background: colors.bg.tertiary,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.default,
    display: 'flex',
    alignItems: 'center',
  },
  
  secondaryHover: {
    background: colors.border.default,
  },
  
  success: {
    padding: '10px 20px',
    background: colors.success,
    color: 'white',
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    transition: transitions.default,
    boxShadow: shadows.md,
    display: 'flex',
    alignItems: 'center',
  },
  
  successHover: {
    background: colors.successHover,
    transform: 'translateY(-1px)',
    boxShadow: shadows['3xl'],
  },
  
  icon: {
    width: '28px',
    height: '28px',
    borderRadius: borderRadius.md,
    border: 'none',
    background: colors.bg.tertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text.secondary,
    transition: transitions.default,
    padding: 0,
  },
  
  iconHover: {
    background: colors.border.default,
    color: colors.primary,
  },
  
  iconLarge: {
    width: '32px',
    height: '32px',
    borderRadius: borderRadius.lg,
    border: 'none',
    background: colors.bg.tertiary,
    cursor: 'pointer',
    fontSize: typography.fontSize['2xl'],
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text.secondary,
    transition: transitions.default,
    fontWeight: typography.fontWeight.light,
  },
  
  iconLargeHover: {
    background: colors.border.default,
    color: colors.primary,
    transform: 'scale(1.05)',
  },
  
  toggle: {
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    borderRadius: borderRadius.lg,
    border: 'none',
    background: colors.bg.tertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text.secondary,
    transition: transitions.default,
    boxShadow: shadows.xl,
    zIndex: 100,
    padding: 0,
  },
  
  toggleHover: {
    background: colors.border.default,
    transform: 'translateY(-50%) scale(1.05)',
  },
};

// Modal styles
export const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  
  container: {
    background: colors.bg.primary,
    padding: spacing['3xl'],
    maxWidth: '90vw',
    maxHeight: '90vh',
    borderRadius: borderRadius['2xl'],
    boxShadow: shadows['4xl'],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xl,
    border: `1px solid ${colors.border.default}`,
  },
  
  containerSmall: {
    width: '400px',
  },
  
  containerMedium: {
    width: '520px',
  },
  
  containerLarge: {
    width: '700px',
  },
  
  title: {
    margin: 0,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  
  description: {
    margin: '0 0 20px 0',
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
  },
  
  buttonContainer: {
    display: 'flex',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
    borderTop: `1px solid ${colors.border.light}`,
  },
};

// Sidebar styles
export const sidebarStyles = {
  container: {
    height: '100vh',
    width: '240px',
    background: colors.bg.primary,
    display: 'flex',
    flexDirection: 'column',
    padding: `${spacing.xl} ${spacing.lg}`,
    gap: spacing['2xl'],
    fontSize: typography.fontSize.md,
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.02)',
    transition: 'transform 0.3s ease, width 0.3s ease',
    transform: 'translateX(0)',
    overflow: 'hidden',
  },
  
  containerLeft: {
    borderRight: `1px solid ${colors.border.default}`,
  },
  
  containerRight: {
    borderLeft: `1px solid ${colors.border.default}`,
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.02)',
  },
  
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing.xs}`,
    marginBottom: spacing.sm,
  },
  
  header: {
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  headerButtons: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
  },
  
  sectionHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    padding: `0 ${spacing.xs}`,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  
  item: {
    padding: `${spacing.md} ${spacing.md}`,
    background: colors.bg.primary,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    cursor: 'pointer',
    transition: transitions.default,
    userSelect: 'none',
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    boxShadow: shadows.sm,
    marginBottom: spacing.md,
  },
  
  itemHover: {
    background: colors.bg.hover,
    borderColor: colors.border.dark,
    transform: 'translateX(-2px)',
    boxShadow: shadows.lg,
  },
  
  itemHoverRight: {
    transform: 'translateX(2px)',
  },
};

// Input styles
export const inputStyles = {
  input: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.fontSize.md,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    background: colors.bg.primary,
    color: colors.text.primary,
    transition: transitions.default,
    width: '100%',
    boxSizing: 'border-box',
  },
  
  inputFocus: {
    borderColor: colors.primary,
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },
  
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  
  select: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.fontSize.md,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    background: colors.bg.primary,
    cursor: 'pointer',
    color: colors.text.primary,
    transition: transitions.default,
    width: '100%',
  },
};

// Toolbar styles
export const toolbarStyles = {
  container: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 10,
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
    background: colors.bg.primary,
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: spacing.md,
    boxShadow: shadows['2xl'],
    border: `1px solid ${colors.border.default}`,
  },
  
  group: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
};

// File tree styles
export const fileTreeStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: `${spacing.sm} ${spacing.md}`,
    background: colors.bg.hover,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.md}`,
    borderRadius: borderRadius.xs,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    cursor: 'pointer',
    transition: transitions.default,
    userSelect: 'none',
  },
  
  itemHover: {
    background: colors.bg.hover,
    color: colors.primary,
  },
  
  fileName: {
    fontSize: typography.fontSize.base,
  },
  
  children: {
    marginLeft: spacing.xl,
    marginTop: spacing.xs,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
};

// Empty state styles
export const emptyStateStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing['4xl']} ${spacing.xl}`,
    textAlign: 'center',
    flex: 1,
  },
  
  text: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginBottom: spacing.xl,
  },
  
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
    maxWidth: '200px',
  },
};
