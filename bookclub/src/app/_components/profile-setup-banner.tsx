"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "profile-banner-dismissed";
const DISMISS_EXPIRY_DAYS = 7; // Show again after 7 days if still incomplete

export function ProfileSetupBanner() {
  const [dismissed, setDismissed] = useState(true); // Start as dismissed, check on mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if banner was dismissed and if dismissal hasn't expired
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil) {
      const expiryDate = new Date(dismissedUntil);
      if (expiryDate > new Date()) {
        setDismissed(true);
        return;
      }
      // Expiry passed, remove from localStorage
      localStorage.removeItem(DISMISS_KEY);
    }
    setDismissed(false);
  }, []);

  const handleDismiss = () => {
    // Set dismissal expiry (7 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + DISMISS_EXPIRY_DAYS);
    localStorage.setItem(DISMISS_KEY, expiryDate.toISOString());
    setDismissed(true);
  };

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted || dismissed) return null;

  return (
    <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <svg
            className="h-5 w-5 flex-shrink-0 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="truncate">
            Complete your profile to get better book recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/profile/setup"
            className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99] whitespace-nowrap"
          >
            Complete Profile
          </Link>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1 text-rose-500/70 transition hover:bg-rose-100 hover:text-rose-600"
            aria-label="Dismiss"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

