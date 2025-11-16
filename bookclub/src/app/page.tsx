import Link from "next/link";
import { auth, signIn, signOut } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <section className="cute-card w-full text-center">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-rose-700">
          Welcome to Bookclub ✨
        </h1>
        <p className="mx-auto mb-6 max-w-prose text-balance text-rose-700/80">
          Create a club, invite your friends, and choose your next great read together. Get tailored recommendations based on your group’s tastes — then vote, read, and discuss.
        </p>

        {session?.user ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-rose-700/80">Signed in as {session.user.name ?? "you"}.</p>
            <div className="flex gap-3">
              <Link href="/clubs" className="cute-button">
                Go to your clubs
              </Link>
              <Link href="/profile" className="cute-button-outline">
                Your profile
              </Link>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button type="submit" className="cute-button-outline text-sm">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <form
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button type="submit" className="cute-button">
                Sign in with Google
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Removed the "What is Bookclub?" section for a cleaner landing */}
    </main>
  );
}
