import Link from "next/link";

import { api } from "~/trpc/server";
import { auth } from "~/server/auth";
import { isSetupComplete } from "~/server/auth/profile-helpers";

export default async function ClubsPage() {
  const session = await auth();
  const clubs = await api.clubs.list();

  // Check if setup is incomplete (either profile text or Goodreads import missing)
  const setupComplete = session?.user?.id
    ? await isSetupComplete(session.user.id)
    : true;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-rose-800">Your Clubs</h1>
          <p className="text-rose-700/70">Browse and manage your book clubs.</p>
        </div>
        <div className="flex items-center gap-3">
          {!setupComplete && (
            <div className="group relative">
              <Link
                href="/profile/setup?step=preferences"
                className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 hover:border-rose-400"
              >
                <svg
                  className="h-4 w-4 text-rose-500"
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
                <span>Complete Profile</span>
              </Link>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform group-hover:block z-50">
                <div className="rounded-lg bg-rose-800 px-3 py-2 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                  Fill out profile preferences to get better book recommendations
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-rose-800"></div>
                </div>
              </div>
            </div>
          )}
          <Link
            href="/clubs/new"
            className="inline-flex items-center gap-2 rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99]"
          >
            + Create Club
          </Link>
        </div>
      </header>

      {clubs.length === 0 ? (
        <section className="cute-card">
          <p className="text-rose-700/80">No clubs yet — create your first one!</p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {clubs.map((c) => (
            <li key={c.id} className="cute-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-rose-800">{c.name}</h3>
                  <p className="text-sm text-rose-700/70">Tap to see details</p>
                </div>
                <Link href={`/clubs/${c.id}`} className="cute-button-outline">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
