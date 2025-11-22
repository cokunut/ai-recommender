import { redirect } from "next/navigation";

import { api } from "~/trpc/server";
import { auth } from "~/server/auth";
import { isProfileComplete, isFirstTimeUser, hasGoodreadsImport, isSetupComplete } from "~/server/auth/profile-helpers";

import { ProfileForm } from "../_components/profile-form";

export default async function ProfileSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  // If setup is complete (both steps), redirect to clubs
  const setupComplete = await isSetupComplete(session.user.id);
  if (setupComplete) {
    redirect("/clubs");
  }

  const resolvedSearchParams = await searchParams;
  const currentStep = resolvedSearchParams?.step;

  const profile = await api.user.getProfile();
  const isFirstTime = await isFirstTimeUser(session.user.id);
  const profileComplete = await isProfileComplete(session.user.id);
  const hasGoodreads = await hasGoodreadsImport(session.user.id);

  // Determine which step to show
  // First-time users start with welcome view (unless they've explicitly moved to a step)
  const showWelcome = isFirstTime && !currentStep;
  const showReadingPreferences = (isFirstTime && currentStep === "preferences") || (!isFirstTime && !profileComplete);
  const showGoodreadsImport = profileComplete && !hasGoodreads;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <section className="cute-card-gradient w-full max-w-md text-center">
        {/* Welcome View (First-time users only) */}
        {showWelcome && (
          <div className="space-y-6">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-rose-900">
              Welcome to Bookclub!
            </h1>
            <div className="space-y-3">
              <p className="text-base text-rose-800 font-medium">
                We're so excited to have you!
              </p>
              <p className="text-sm text-rose-700/80">
                Let's set up your profile to get personalized book recommendations and start connecting with your reading community.
              </p>
            </div>
            <form action="/profile/setup" method="get" className="pt-4">
              <input type="hidden" name="step" value="preferences" />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99]"
              >
                Get Started
              </button>
            </form>
          </div>
        )}

        {/* Step 1: Reading Preferences */}
        {showReadingPreferences && (
          <div className="text-left">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-rose-900 text-center">
              {isFirstTime ? "Welcome to Bookclub!" : "Complete Your Profile"}
            </h1>
            <h2 className="mb-3 text-lg font-semibold text-rose-800">Reading Preferences</h2>
            <p className="mb-4 text-sm text-rose-700/80">
              Share your favorite genres, authors, and books.
            </p>
            <ProfileForm initialText={profile?.profileText ?? ""} redirectOnSave="/profile/setup" alwaysEditing={true} />
            <div className="mt-4 text-center">
              <a
                href="/clubs"
                className="text-sm text-rose-700/70 hover:text-rose-800 underline"
              >
                Skip for now →
              </a>
            </div>
          </div>
        )}

        {/* Step 2: Goodreads Import */}
        {showGoodreadsImport && (
          <div className="text-left">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-rose-900 text-center">
              {isFirstTime ? "Welcome to Bookclub!" : "Complete Your Profile"}
            </h1>
            <h2 className="mb-3 text-lg font-semibold text-rose-800">Import from Goodreads</h2>
            <p className="mb-4 text-sm text-rose-700/80">
              Sync your Goodreads data to get better book recommendations.
            </p>
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-rose-700/90">
                <li>
                  Visit <a className="underline hover:text-rose-800" href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">Goodreads Export</a> and request your CSV export.
                </li>
                <li>Download the CSV file when it's ready.</li>
                <li>Upload the CSV here:</li>
              </ol>

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
            </div>
            <div className="mt-4 text-center">
              <a
                href="/clubs"
                className="text-sm text-rose-700/70 hover:text-rose-800 underline"
              >
                Skip for now →
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

