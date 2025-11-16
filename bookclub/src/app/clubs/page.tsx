import Link from "next/link";
import { auth } from "~/server/auth";

export default async function ClubsPage() {
  const session = await auth();

  const clubs: Array<{ id: string; name: string }> = [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-rose-800">Your Clubs</h1>
          <p className="text-rose-700/70">
            {session?.user ? `Welcome, ${session.user.name ?? "reader"}!` : "Browsing without an account."}
          </p>
        </div>
        <Link href="/clubs/new" className="cute-button text-base">
          + Create Club
        </Link>
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

