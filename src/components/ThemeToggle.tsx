"use client";

import React, { useState, useRef, useEffect } from "react";
import { Monitor, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectTheme = (newTheme: "system" | "light" | "dark") => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  const getThemeTitle = () => {
    if (theme === "system") {
      return `Theme: System (${resolvedTheme})`;
    }
    return `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  };

  return (
    <div className={`theme-dropdown-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`theme-toggle-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Select theme mode"
        title={getThemeTitle()}
      >
        {theme === "system" ? (
          <Monitor size={17} />
        ) : theme === "light" ? (
          <Sun size={17} />
        ) : (
          <Moon size={17} />
        )}
      </button>

      {isOpen && (
        <div className="theme-dropdown-menu" role="menu" aria-label="Theme options">
          <button
            type="button"
            className={`theme-dropdown-item ${theme === "system" ? "active" : ""}`}
            onClick={() => selectTheme("system")}
            role="menuitem"
          >
            <div className="theme-dropdown-item-content">
              <Monitor size={14} className="theme-dropdown-item-icon" />
              <span>System</span>
            </div>
            {theme === "system" && <Check size={14} className="theme-dropdown-check" />}
          </button>

          <button
            type="button"
            className={`theme-dropdown-item ${theme === "light" ? "active" : ""}`}
            onClick={() => selectTheme("light")}
            role="menuitem"
          >
            <div className="theme-dropdown-item-content">
              <Sun size={14} className="theme-dropdown-item-icon" />
              <span>Light</span>
            </div>
            {theme === "light" && <Check size={14} className="theme-dropdown-check" />}
          </button>

          <button
            type="button"
            className={`theme-dropdown-item ${theme === "dark" ? "active" : ""}`}
            onClick={() => selectTheme("dark")}
            role="menuitem"
          >
            <div className="theme-dropdown-item-content">
              <Moon size={14} className="theme-dropdown-item-icon" />
              <span>Dark</span>
            </div>
            {theme === "dark" && <Check size={14} className="theme-dropdown-check" />}
          </button>
        </div>
      )}
    </div>
  );
}
