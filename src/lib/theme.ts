"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "bsf_theme";

function getThemeSnapshot(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {}
  return "system";
}

function getThemeServerSnapshot(): ThemeMode {
  return "system";
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("bsf_theme_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bsf_theme_change", callback);
  };
}

function getSystemThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSystemThemeServerSnapshot(): ResolvedTheme {
  return "dark";
}

function subscribeSystemTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

/**
 * Custom hook to manage 3-way theme state: "system" | "light" | "dark".
 * Defaults to "system" (automatic OS preference), but persists manual selections to localStorage.
 * Uses useSyncExternalStore for optimal React 19 concurrent hydration and zero cascading renders.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const systemPreference = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot
  );

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemPreference : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      window.dispatchEvent(new Event("bsf_theme_change"));
    } catch (e) {
      console.warn("Could not save theme preference to localStorage:", e);
    }
  }, []);

  return { theme, resolvedTheme, setTheme };
}
