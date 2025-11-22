"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function DeleteClubButton({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = api.clubs.delete.useMutation({
    onSuccess: () => {
      router.push("/clubs");
    },
    onError: (err) => {
      setError(err.message ?? "Failed to delete club");
      setShowConfirm(false);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: clubId });
  };

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-rose-700/80">Are you sure you want to delete this club? This action cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="cute-button bg-rose-600 hover:bg-rose-700"
          >
            {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              setError(null);
            }}
            className="cute-button-outline"
            disabled={deleteMutation.isPending}
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
      title="Delete Club"
    >
      🗑️
    </button>
  );
}

