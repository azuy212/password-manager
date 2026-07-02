/**
 * Forest Green Theme - Dark Mode First
 * A premium, security-focused aesthetic for a password manager
 */

export type ThemeColors = {
  // Primary
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;

  // Background
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceSecondary: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Accent
  accent: string;
  accentMuted: string;

  // Feedback
  danger: string;
  dangerLight: string;
  success: string;
  warning: string;

  // Borders & Dividers
  border: string;
  borderLight: string;
  divider: string;

  // Interactive
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;

  // Input
  inputBackground: string;
  inputBorder: string;
  placeholder: string;

  // Overlay
  overlay: string;
  overlayHeavy: string;

  // Shadows
  shadow: string;
  glow: string;
};

const dark: ThemeColors = {
  // Primary - Forest Green
  primary: '#2D6A4F',
  primaryLight: '#40916C',
  primaryDark: '#1B4332',
  primaryMuted: 'rgba(45, 106, 79, 0.15)',

  // Background - Charcoal/Near-black
  background: '#0D0F0E',
  backgroundSecondary: '#141716',
  backgroundTertiary: '#1A1E1C',
  surface: '#1E2220',
  surfaceSecondary: '#252A27',

  // Text - High contrast off-white
  text: '#F0F2F1',
  textSecondary: '#A8B0AC',
  textTertiary: '#6B7370',
  textInverse: '#0D0F0E',

  // Accent - Soft green glow
  accent: '#52B788',
  accentMuted: 'rgba(82, 183, 136, 0.2)',

  // Feedback
  danger: '#E63946',
  dangerLight: 'rgba(230, 57, 70, 0.15)',
  success: '#52B788',
  warning: '#E9C46A',

  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.06)',

  // Interactive
  tint: '#52B788',
  tabIconDefault: '#6B7370',
  tabIconSelected: '#52B788',

  // Input
  inputBackground: '#1A1E1C',
  inputBorder: 'rgba(255, 255, 255, 0.08)',
  placeholder: '#6B7370',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayHeavy: 'rgba(0, 0, 0, 0.8)',

  // Shadows
  shadow: '#000000',
  glow: 'rgba(82, 183, 136, 0.3)',
};

const light: ThemeColors = {
  // Primary - Forest Green (slightly deeper for light mode)
  primary: '#2D6A4F',
  primaryLight: '#40916C',
  primaryDark: '#1B4332',
  primaryMuted: 'rgba(45, 106, 79, 0.1)',

  // Background - Clean whites with subtle warmth
  background: '#FAFBFA',
  backgroundSecondary: '#F2F4F3',
  backgroundTertiary: '#E8EBE9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7F9F8',

  // Text
  text: '#1A1E1C',
  textSecondary: '#5C6660',
  textTertiary: '#8A9490',
  textInverse: '#FFFFFF',

  // Accent
  accent: '#40916C',
  accentMuted: 'rgba(64, 145, 108, 0.15)',

  // Feedback
  danger: '#D62839',
  dangerLight: 'rgba(214, 40, 57, 0.1)',
  success: '#40916C',
  warning: '#D4A017',

  // Borders & Dividers
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  divider: 'rgba(0, 0, 0, 0.06)',

  // Interactive
  tint: '#40916C',
  tabIconDefault: '#8A9490',
  tabIconSelected: '#40916C',

  // Input
  inputBackground: '#F2F4F3',
  inputBorder: 'rgba(0, 0, 0, 0.08)',
  placeholder: '#8A9490',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayHeavy: 'rgba(0, 0, 0, 0.6)',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.12)',
  glow: 'rgba(64, 145, 108, 0.25)',
};

export default {
  light,
  dark,
  unspecified: dark, // Default to dark theme if no preference is set
};
