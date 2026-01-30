import { colors, shadows } from './theme';

// Utility functions for hover effects to replace inline onMouseEnter/onMouseLeave handlers

export const hoverHandlers = {
  // Icon button hover (small icon buttons)
  iconButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.border.default;
      e.currentTarget.style.color = colors.primary;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.tertiary;
      e.currentTarget.style.color = colors.text.secondary;
    },
  },
  
  // Large icon button hover (with scale)
  iconButtonLarge: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.border.default;
      e.currentTarget.style.color = colors.primary;
      e.currentTarget.style.transform = 'scale(1.05)';
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.tertiary;
      e.currentTarget.style.color = colors.text.secondary;
      e.currentTarget.style.transform = 'scale(1)';
    },
  },
  
  // Primary button hover
  primaryButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.primaryHover;
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = shadows['3xl'];
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.primary;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = shadows.md;
    },
  },
  
  // Secondary button hover
  secondaryButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.border.default;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.tertiary;
    },
  },
  
  // Success button hover
  successButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.successHover;
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = shadows['3xl'];
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.success;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = shadows.md;
    },
  },
  
  // Toggle button hover
  toggleButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.border.default;
      e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.tertiary;
      e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
    },
  },
  
  // Sidebar item hover (left sidebar - moves right)
  sidebarItemLeft: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.bg.hover;
      e.currentTarget.style.borderColor = colors.border.dark;
      e.currentTarget.style.transform = 'translateX(2px)';
      e.currentTarget.style.boxShadow = shadows.lg;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.primary;
      e.currentTarget.style.borderColor = colors.border.default;
      e.currentTarget.style.transform = 'translateX(0)';
      e.currentTarget.style.boxShadow = shadows.sm;
    },
  },
  
  // Sidebar item hover (right sidebar - moves left)
  sidebarItemRight: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.bg.hover;
      e.currentTarget.style.borderColor = colors.border.dark;
      e.currentTarget.style.transform = 'translateX(-2px)';
      e.currentTarget.style.boxShadow = shadows.lg;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.primary;
      e.currentTarget.style.borderColor = colors.border.default;
      e.currentTarget.style.transform = 'translateX(0)';
      e.currentTarget.style.boxShadow = shadows.sm;
    },
  },
  
  // File item hover
  fileItem: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.bg.hover;
      e.currentTarget.style.color = colors.primary;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = colors.text.secondary;
    },
  },
  
  // Input focus
  inputFocus: {
    onFocus: (e) => {
      e.target.style.borderColor = colors.primary;
      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    },
    onBlur: (e) => {
      e.target.style.borderColor = colors.border.default;
      e.target.style.boxShadow = 'none';
    },
  },
  
  // Delete button hover (red)
  deleteButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.dangerLight;
      e.currentTarget.style.color = colors.danger;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = colors.text.tertiary;
    },
  },
  
  // Repo list item hover
  repoListItem: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.bg.hover;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = 'transparent';
    },
  },
  
  // Open repo button hover
  openRepoButton: {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = colors.border.default;
      e.currentTarget.style.borderColor = colors.border.dark;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = colors.bg.tertiary;
      e.currentTarget.style.borderColor = colors.border.default;
    },
  },
};
