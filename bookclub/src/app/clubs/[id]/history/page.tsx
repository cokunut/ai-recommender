import Link from "next/link";
import { api } from "~/trpc/server";
import { HistoryList } from "./HistoryList";

export default async function ClubHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await api.clubs.byId({ id });
  const history = await api.clubs.history({ id });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href={`/clubs/${id}`}>← Back to club</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-2 text-2xl font-bold text-rose-800">
          History - {group?.name ?? "Club"}
        </h1>
        <p className="text-rose-700/80">
          {history.length === 0
            ? "No completed reading rounds yet."
            : `${history.length} completed reading round${history.length === 1 ? "" : "s"}`}
        </p>
      </section>
      {history.length > 0 && <HistoryList history={history} clubId={id} />}
    </main>
  );
}
