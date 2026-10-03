import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  getRelativeLuminance,
  getContrastRatio,
  isDarkColor,
  getAdaptiveTypography,
  PRESET_BACKGROUND_COLORS,
} from "../../lib/theme/contrast";

describe("Adaptive Color Contrast & Typography Engine", () => {
  it("converts 3-digit and 6-digit hex strings to accurate RGB values", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#f8fafc")).toEqual({ r: 248, g: 250, b: 252 });
    expect(hexToRgb("#00133d")).toEqual({ r: 0, g: 19, b: 61 });
    expect(hexToRgb("invalid")).toBeNull();
  });

  it("calculates WCAG 2.1 relative luminance accurately", () => {
    // Pure black has luminance 0
    expect(getRelativeLuminance(0, 0, 0)).toBe(0);
    // Pure white has luminance 1
    expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
    // Mid gray has predictable luminance
    const midGrayLum = getRelativeLuminance(128, 128, 128);
    expect(midGrayLum).toBeGreaterThan(0.2);
    expect(midGrayLum).toBeLessThan(0.3);
  });

  it("calculates contrast ratios conforming to WCAG formulas", () => {
    // White vs Black is 21:1
    const whiteVsBlack = getContrastRatio(1.0, 0.0);
    expect(whiteVsBlack).toBeCloseTo(21.0, 1);

    // Same colors have contrast ratio 1:1
    const same = getContrastRatio(0.5, 0.5);
    expect(same).toBe(1.0);
  });

  it("accurately classifies dark and light background colors", () => {
    expect(isDarkColor("#000000")).toBe(true);
    expect(isDarkColor("#05070d")).toBe(true);
    expect(isDarkColor("#00133d")).toBe(true);
    expect(isDarkColor("#031c16")).toBe(true);
    expect(isDarkColor("#1a082b")).toBe(true);

    expect(isDarkColor("#ffffff")).toBe(false);
    expect(isDarkColor("#f8fafc")).toBe(false);
    expect(isDarkColor("#fffbeb")).toBe(false);
  });

  it("computes adaptive typography tokens guaranteeing WCAG contrast for dark backgrounds", () => {
    const darkTheme = getAdaptiveTypography("#05070d");
    expect(darkTheme.isDark).toBe(true);
    expect(darkTheme.textPrimary).toBe("text-white");
    expect(darkTheme.textSecondary).toBe("text-slate-300");
    expect(darkTheme.cardBg).toContain("slate-950");
    expect(darkTheme.contrastRatioAgainstWhite).toBeGreaterThan(10);
  });

  it("computes adaptive typography tokens guaranteeing WCAG contrast for light backgrounds", () => {
    const lightTheme = getAdaptiveTypography("#f8fafc");
    expect(lightTheme.isDark).toBe(false);
    expect(lightTheme.textPrimary).toBe("text-slate-950");
    expect(lightTheme.textSecondary).toBe("text-slate-700");
    expect(lightTheme.contrastRatioAgainstBlack).toBeGreaterThan(10);
  });

  it("provides comprehensive preset background colors", () => {
    expect(PRESET_BACKGROUND_COLORS.length).toBeGreaterThanOrEqual(4);
    for (const preset of PRESET_BACKGROUND_COLORS) {
      expect(preset.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.label).toBeDefined();
      expect(preset.overlayStyle).toBeDefined();
    }
  });
});
