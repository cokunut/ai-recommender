"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  // Don't show sidebar on login page
  if (pathname === "/") {
    return null;
  }

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-64 bg-white/80 backdrop-blur-sm border-r border-rose-200/50 p-6">
      <nav className="flex flex-col gap-2">
        {/* Clubs/Home link */}
        <Link
          href="/clubs"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
            isActive("/clubs")
              ? "bg-rose-100 text-rose-700"
              : "text-rose-600 hover:bg-rose-50"
          }`}
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="font-medium">Clubs</span>
        </Link>

        {/* Profile link */}
        <Link
          href="/profile"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
            isActive("/profile")
              ? "bg-rose-100 text-rose-700"
              : "text-rose-600 hover:bg-rose-50"
          }`}
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="font-medium">Profile</span>
        </Link>
      </nav>
    </aside>
  );
}

