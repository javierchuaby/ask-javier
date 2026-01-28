"use client";

import { useState, useEffect } from "react";
import { isValentinePeriod, getTimeUntilValentineEnd } from "@/app/utils/dateUtils";

interface TopBarProps {
  theme: string | undefined;
  mounted: boolean;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
}

export function TopBar({ theme, mounted, onToggleTheme, onOpenSidebar }: TopBarProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number } | null>(null);
  const isValentine = isValentinePeriod();

  useEffect(() => {
    if (!isValentine) return;

    const updateTimer = () => {
      setTimeLeft(getTimeUntilValentineEnd());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isValentine]);

  return (
    <div className="topbar bg-[var(--bg-primary)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onOpenSidebar}
          className="sidebar-button md:hidden"
          aria-label="Open sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <header className="flex-1 flex justify-between items-center">
          <div>
            <h1 className={`text-xl font-bold text-[var(--chat-text)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}>Ask Javier</h1>
            <p className={`text-xs text-[var(--chat-text-muted)] italic ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}>For Aiden Lei Lopez</p>
          </div>

          {/* Valentine's Countdown */}
          {isValentine && (
            <div className="hidden sm:flex items-center gap-2 text-[var(--valentine-accent)] font-[family-name:var(--font-itim)]">
              <span className="text-lg animate-pulse">❤</span>
              {timeLeft ? (
                <span>{timeLeft.days}d {timeLeft.hours}h until Valentine's Day</span>
              ) : (
                <span>Happy Valentine's Day!</span>
              )}
            </div>
          )}
        </header>
      </div>
      {!isValentine && (
        <button
          onClick={onToggleTheme}
          className="sidebar-button"
          aria-label="Toggle theme"
        >
          {!mounted || theme === "dark" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
