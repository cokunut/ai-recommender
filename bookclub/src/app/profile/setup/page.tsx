import { redirect } from "next/navigation";

import { api } from "~/trpc/server";
import { auth } from "~/server/auth";
import { isProfileComplete, isFirstTimeUser } from "~/server/auth/profile-helpers";

import { ProfileForm } from "../_components/profile-form";

export default async function ProfileSetupPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const profileComplete = await isProfileComplete(session.user.id);

  // If profile is already complete, redirect to clubs
  if (profileComplete) {
    redirect("/clubs");
  }

  const profile = await api.user.getProfile();
  const isFirstTime = await isFirstTimeUser(session.user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <section className="cute-card-gradient w-full max-w-md text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-rose-900">
          {isFirstTime ? "Welcome to Bookclub!" : "Complete Your Profile"}
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm text-rose-700/70">
          {isFirstTime
            ? "Tell us about your reading preferences to get personalized book recommendations."
            : "Complete your profile to get better recommendations and join clubs."}
        </p>

        <div className="text-left">
          <h2 className="mb-3 text-lg font-semibold text-rose-800">Reading Preferences</h2>
          <p className="mb-4 text-sm text-rose-700/80">
            Share what you enjoy reading and list a few books you loved.
          </p>
          <ProfileForm initialText={profile?.profileText ?? ""} redirectOnSave="/clubs" alwaysEditing={true} />
        </div>

        {!isFirstTime && (
          <div className="mt-4">
            <a
              href="/clubs"
              className="text-sm text-rose-700/70 hover:text-rose-800 underline"
            >
              Skip for now →
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

