import Link from "next/link";
import { api } from "~/trpc/server";

export default async function ClubDetailsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const group = await api.clubs.byId({ id });
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/clubs">← Back to clubs</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-2 text-2xl font-bold text-rose-800">{group?.name ?? "Club details"}</h1>
        <p className="text-rose-700/80">{group?.description ?? `club details here (id: ${id})`}</p>
      </section>
    </main>
  );
}
