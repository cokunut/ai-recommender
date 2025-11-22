"use client";

import Link from "next/link";
import { useState } from "react";

export function ProfileSetupBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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
          <p>
            Complete your profile to get better book recommendations and join clubs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/profile/setup"
            className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Complete Profile
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg px-2 py-1 text-rose-500 transition hover:bg-rose-100"
            aria-label="Dismiss"
          >
            <svg
              className="h-5 w-5"
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

