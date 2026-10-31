"use client";

import React from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className={`theme-segmented-control ${className}`}
      role="radiogroup"
      aria-label="Theme mode"
      title={
        theme === "system"
          ? `Theme: System (currently ${resolvedTheme})`
          : `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`
      }
    >
      <button
        type="button"
        className={`theme-segment-btn ${theme === "system" ? "active" : ""}`}
        onClick={() => setTheme("system")}
        aria-checked={theme === "system"}
        role="radio"
        title="System mode (follow OS theme)"
      >
        <Monitor size={14} />
      </button>

      <button
        type="button"
        className={`theme-segment-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => setTheme("light")}
        aria-checked={theme === "light"}
        role="radio"
        title="Light mode"
      >
        <Sun size={14} />
      </button>

      <button
        type="button"
        className={`theme-segment-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        aria-checked={theme === "dark"}
        role="radio"
        title="Dark mode"
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
