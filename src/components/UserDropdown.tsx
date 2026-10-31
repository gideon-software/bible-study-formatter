"use client";

import React, { useState, useRef, useEffect } from "react";
import { LogOut, ShieldCheck, History } from "lucide-react";

interface UserDropdownProps {
  user: {
    name?: string;
    email?: string;
    picture?: string;
  };
  isAdmin?: boolean;
  historyCount?: number;
  onOpenHistory?: () => void;
  onLogout: () => void;
}

export function UserDropdown({
  user,
  isAdmin = false,
  historyCount = 0,
  onOpenHistory,
  onLogout,
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const handleLogoutClick = () => {
    setIsOpen(false);
    onLogout();
  };

  const displayName = user.name || user.email?.split("@")[0] || "User";
  const initial = (user.name || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="user-menu-container" ref={containerRef}>
      <button
        type="button"
        className={`user-avatar-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`User menu for ${displayName}`}
        title={displayName}
      >
        {user.picture && !avatarError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={user.picture}
            alt={displayName}
            className="user-avatar-img"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="user-avatar-fallback" aria-hidden="true">
            {initial}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="user-dropdown-menu" role="menu">
          <div className="user-dropdown-header">
            {user.name && <div className="user-dropdown-name">{user.name}</div>}
            {user.email && <div className="user-dropdown-email">{user.email}</div>}
          </div>

          <div className="user-dropdown-divider" />

          {onOpenHistory && (
            <>
              <button
                type="button"
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenHistory();
                }}
              >
                <History size={16} />
                <span style={{ flex: 1, textAlign: "left" }}>Document history</span>
                {historyCount > 0 && (
                  <span className="user-dropdown-badge">{historyCount}</span>
                )}
              </button>
              <div className="user-dropdown-divider" />
            </>
          )}

          {isAdmin && (
            <>
              <a
                href="/admin"
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                <ShieldCheck size={16} />
                <span>Admin Portal</span>
              </a>
              <div className="user-dropdown-divider" />
            </>
          )}

          <button
            type="button"
            className="user-dropdown-item user-dropdown-logout"
            role="menuitem"
            onClick={handleLogoutClick}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
