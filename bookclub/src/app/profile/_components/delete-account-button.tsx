"use client";

import { useState } from "react";

import { deleteAccount } from "~/server/auth/actions";

export function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // deleteAccount() will redirect on success, so we don't need router.refresh()
    } catch (error) {
      // Next.js redirects throw errors with digest starting with "NEXT_REDIRECT"
      // These are success cases (user deleted, now redirecting to home page)
      // NOT actual errors - we need to let them propagate so the redirect happens
      if (
        error &&
        typeof error === "object" &&
        "digest" in error &&
        typeof error.digest === "string" &&
        error.digest.startsWith("NEXT_REDIRECT")
      ) {
        // This is a redirect (success path) - re-throw so Next.js handles it
        throw error;
      }
      // This is a real error (database failure, validation error, etc.)
      // Show error message to user and reset loading state
      console.error("Failed to delete account:", error);
      setIsDeleting(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete account. Please try again.";
      setError(errorMessage);
    }
  }

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => {
          setShowConfirm(true);
          setError(null);
        }}
        className="w-full rounded-full border border-rose-300 bg-white/70 px-6 py-3 text-base font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 hover:shadow-md cursor-pointer active:scale-[0.99]"
      >
        Delete Account
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-rose-300 bg-rose-50/50 p-4">
      <p className="text-sm font-medium text-rose-800">
        Are you sure you want to delete your account? This action cannot be undone.
      </p>
      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
          className="flex-1 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 rounded-xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? "Deleting..." : "Yes, Delete Account"}
        </button>
      </div>
    </div>
  );
}

