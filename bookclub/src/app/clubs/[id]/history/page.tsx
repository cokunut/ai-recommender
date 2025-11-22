import Link from "next/link";
import { api } from "~/trpc/server";

export default async function ClubHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await api.clubs.byId({ id });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href={`/clubs/${id}`}>← Back to club</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-2 text-2xl font-bold text-rose-800">
          History - {group?.name ?? "Club"}
        </h1>
        <p className="text-rose-700/80">History page coming soon...</p>
      </section>
    </main>
  );
}

