import Link from "next/link";
import { api } from "~/trpc/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({ searchParams }: { searchParams?: { import?: string } }) {
  const profile = await api.user.getProfile();

  const importStatus = searchParams?.import;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/">← Home</Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-rose-800">Your Profile</h1>
        <p className="text-rose-700/70">Share what you love to read and add past favorites.</p>
      </header>

      <section className="cute-card mb-6">
        <h2 className="mb-3 text-xl font-semibold text-rose-800">Reading Preferences</h2>
        <p className="mb-4 text-sm text-rose-700/80">
          Tell us what you enjoy reading and list a few books you loved.
        </p>
        <ProfileForm />
      </section>

      <section className="cute-card">
        <h2 className="mb-3 text-xl font-semibold text-rose-800">Import from Goodreads</h2>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-rose-700/90">
          <li>
            Visit <a className="underline hover:text-rose-800" href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">Goodreads Export</a> and request your CSV export.
          </li>
          <li>Download the CSV file when it’s ready.</li>
          <li>Upload the CSV here:</li>
        </ol>

        {importStatus === "success" && (
          <p className="mb-3 rounded-md bg-emerald-50 p-2 text-sm text-emerald-700">Import received! We saved your file.</p>
        )}
        {importStatus === "error" && (
          <p className="mb-3 rounded-md bg-rose-50 p-2 text-sm text-rose-700">Import failed. Please try again.</p>
        )}

        <form action="/api/goodreads-import" method="post" encType="multipart/form-data" className="space-y-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-rose-800 file:mr-4 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-rose-800 hover:file:bg-rose-200"
            required
          />
          <button type="submit" className="cute-button">Upload CSV</button>
        </form>

        {profile?.goodreadsImports?.[0] && (
          <p className="mt-4 text-xs text-rose-700/70">
            Last import: {new Date(profile.goodreadsImports[0]!.createdAt as unknown as string).toLocaleString()} ({profile.goodreadsImports[0]!.status})
          </p>
        )}
      </section>
    </main>
  );
}
