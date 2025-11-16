import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

export default function NewClubPage() {
  async function createClub(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || undefined;
    const governanceMode = (formData.get("governanceMode") as string) || "OWNER_ADMIN";
    const group = await api.clubs.create({ name, description, governanceMode: governanceMode as any });
    redirect(`/clubs/${group.id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/clubs">← Back to clubs</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-3 text-2xl font-bold text-rose-800">Create a new club</h1>
        <form action={createClub} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-rose-800">Name</label>
            <input
              name="name"
              required
              className="w-full rounded-xl border border-rose-200 bg-white/90 px-3 py-2 outline-none focus:border-rose-300"
              placeholder="Cozy Fantasy Readers"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-rose-800">Description (optional)</label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-xl border border-rose-200 bg-white/90 px-3 py-2 outline-none focus:border-rose-300"
              placeholder="We read whimsical fantasy with tea."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-rose-800">Governance</label>
            <select
              name="governanceMode"
              className="w-full rounded-xl border border-rose-200 bg-white/90 px-3 py-2 outline-none focus:border-rose-300"
              defaultValue="OWNER_ADMIN"
            >
              <option value="OWNER_ADMIN">Owner-admin</option>
              <option value="ALL_MEMBERS">All members</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="cute-button">Create club</button>
            <Link href="/clubs" className="cute-button-outline">Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
