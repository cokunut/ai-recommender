import Link from "next/link";

export default function NewClubPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/clubs">← Back to clubs</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-3 text-2xl font-bold text-rose-800">Create a new club</h1>
        <p className="text-rose-700/80">Create club form goes here.</p>
      </section>
    </main>
  );
}

