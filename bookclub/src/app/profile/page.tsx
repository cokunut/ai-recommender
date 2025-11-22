import { api } from "~/trpc/server";

import { DeleteAccountButton } from "./_components/delete-account-button";
import { ProfileForm } from "./_components/profile-form";
import { logout } from "~/server/auth/actions";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ import?: string }> }) {
  const profile = await api.user.getProfile();

  const resolvedSearchParams = await searchParams;
  const importStatus = resolvedSearchParams?.import;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-rose-800">{profile?.name ?? "Your Profile"}</h1>
        <p className="text-rose-700/70">Share what you love to read and add past favorites.</p>
      </header>

      <section className="cute-card mb-6">
        <h2 className="mb-3 text-xl font-semibold text-rose-800">Reading Preferences</h2>
        <p className="mb-4 text-sm text-rose-700/80">
          Tell us what you enjoy reading and list a few books you loved.
        </p>
        <ProfileForm initialText={profile?.profileText ?? ""} />
      </section>

      <section className="cute-card mb-6">
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
            className="block w-full text-xs text-rose-500/30 file:mr-4 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-rose-800 file:text-sm file:cursor-pointer"
            required
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99]"
          >
            Upload CSV
          </button>
        </form>

        {profile?.goodreadsImports?.[0] && (
          <p className="mt-4 text-xs text-rose-700/70">
            Last import: {new Date(profile.goodreadsImports[0]!.createdAt as unknown as string).toLocaleString()} ({profile.goodreadsImports[0]!.status})
          </p>
        )}
      </section>

      {/* Delete Account and Logout */}
      <section className="cute-card">
        <h2 className="mb-4 text-xl font-semibold text-rose-800">Account Actions</h2>
        <div className="flex flex-col gap-3">
          {/* Logout button */}
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-full border border-rose-300 bg-white/70 px-6 py-3 text-base font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 hover:shadow-md cursor-pointer active:scale-[0.99]"
            >
              Logout
            </button>
          </form>

          {/* Delete Account button */}
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
