import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { isFirstTimeUser } from "~/server/auth/profile-helpers";

import { EmailPasswordForm } from "./auth/email-password-form";

export default async function Home() {
  const session = await auth();

  // Redirect logged-in users
  if (session?.user?.id) {
    // Check if first-time user → redirect to setup (shows welcome view)
    const isFirstTime = await isFirstTimeUser(session.user.id);
    if (isFirstTime) {
      redirect("/profile/setup");
    }
    
    // Returning user - redirect to clubs
    redirect("/clubs");
  }

  // Show login page for non-logged-in users
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      {/* Logo in top left */}
      <div className="fixed left-6 top-6 flex items-center gap-2">
        <div className="rounded-md bg-rose-600 p-1.5">
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </div>
        <span className="text-xl font-semibold text-rose-900">Bookclub</span>
      </div>

      {/* Main card */}
      <section className="cute-card-gradient w-full max-w-md text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-rose-900">
          Welcome back!
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm text-rose-700/70">
          Gather your clubs and plan your next chapter together.
        </p>

        <div className="flex flex-col gap-4">
          <EmailPasswordForm />

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-rose-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-rose-500">OR</span>
            </div>
          </div>

          {/* Google sign-in button */}
          <form
            action={async () => {
              "use server";
              const { signIn } = await import("~/server/auth");
              await signIn("google", { redirectTo: "/" });
            }}
            className="w-full"
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-rose-200 bg-white py-3 text-rose-900 transition hover:bg-rose-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-medium">Sign in with Google</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
