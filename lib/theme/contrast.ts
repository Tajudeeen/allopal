/**
 * Adaptive Color Contrast & Typography Engine
 * Computes WCAG 2.1 Relative Luminance and contrast ratios so that
 * all text across every component adapts to any background color.
 */

export interface AdaptiveTypography {
  readonly isDark: boolean;
  readonly luminance: number;
  readonly contrastRatioAgainstWhite: number;
  readonly contrastRatioAgainstBlack: number;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly cardBg: string;
  readonly cardBorder: string;
  readonly subCardBg: string;
  readonly subCardBorder: string;
  readonly badgeBg: string;
  readonly badgeText: string;
  readonly accentColor: string;
}

export interface AppBackgroundColor {
  readonly id: string;
  readonly label: string;
  readonly hex: string;
  readonly overlayStyle: string;
}

/**
 * Standard preset background colors with pre-calibrated overlay tints
 */
export const PRESET_BACKGROUND_COLORS: readonly AppBackgroundColor[] = [
  {
    id: "obsidian",
    label: "Obsidian Void",
    hex: "#05070d",
    overlayStyle: "bg-black/55 backdrop-blur-[0.5px]",
  },
  {
    id: "alabaster",
    label: "Alabaster Daylight",
    hex: "#f8fafc",
    overlayStyle: "bg-white/88 backdrop-blur-md",
  },
  {
    id: "navy",
    label: "PayPal Midnight",
    hex: "#00133d",
    overlayStyle: "bg-gradient-to-b from-[#00133d]/85 via-[#000922]/80 to-[#00133d]/90 backdrop-blur-sm",
  },
  {
    id: "emerald",
    label: "Cyber Emerald",
    hex: "#031c16",
    overlayStyle: "bg-gradient-to-b from-[#031c16]/85 via-[#010e0b]/80 to-[#031c16]/90 backdrop-blur-sm",
  },
  {
    id: "amethyst",
    label: "Amethyst Deep",
    hex: "#1a082b",
    overlayStyle: "bg-gradient-to-b from-[#1a082b]/85 via-[#0d0317]/80 to-[#1a082b]/90 backdrop-blur-sm",
  },
  {
    id: "amber",
    label: "Warm Amber",
    hex: "#fffbeb",
    overlayStyle: "bg-amber-50/90 backdrop-blur-md",
  },
];

/**
 * Parse a 3 or 6 digit hex color into RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB triplet (0 to 1)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG contrast ratio between two luminance values (1 to 21)
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluates whether a background color is dark based on WCAG luminance threshold
 */
export function isDarkColor(hexOrRgb: string): boolean {
  const rgb = hexToRgb(hexOrRgb);
  if (!rgb) {
    // Default fallback to dark
    return true;
  }
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  // Luminance <= 0.45 indicates a dark background requiring light text
  return lum <= 0.45;
}

/**
 * Computes complete adaptive typography tokens for any given background color
 */
export function getAdaptiveTypography(bgColorHex: string): AdaptiveTypography {
  const rgb = hexToRgb(bgColorHex) || { r: 5, g: 7, b: 13 };
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrastWhite = getContrastRatio(lum, 1.0); // white luminance = 1.0
  const contrastBlack = getContrastRatio(lum, 0.0); // black luminance = 0.0

  const isDark = lum <= 0.45;

  if (isDark) {
    return {
      isDark: true,
      luminance: lum,
      contrastRatioAgainstWhite: contrastWhite,
      contrastRatioAgainstBlack: contrastBlack,
      textPrimary: "text-white",
      textSecondary: "text-slate-300",
      textMuted: "text-slate-400",
      cardBg: "bg-slate-950/85",
      cardBorder: "border-slate-800/80",
      subCardBg: "bg-slate-900/60",
      subCardBorder: "border-slate-800/60",
      badgeBg: "bg-blue-500/10",
      badgeText: "text-blue-400",
      accentColor: "#38bdf8",
    };
  }

  return {
    isDark: false,
    luminance: lum,
    contrastRatioAgainstWhite: contrastWhite,
    contrastRatioAgainstBlack: contrastBlack,
    textPrimary: "text-slate-950",
    textSecondary: "text-slate-700",
    textMuted: "text-slate-500",
    cardBg: "bg-white/92",
    cardBorder: "border-slate-200/90",
    subCardBg: "bg-slate-50/80",
    subCardBorder: "border-slate-200/80",
    badgeBg: "bg-blue-50",
    badgeText: "text-[#1736b8]",
    accentColor: "#1f4fe0",
  };
}
