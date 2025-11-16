"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function JoinClubButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const joinMutation = api.clubs.join.useMutation({
    onSuccess: () => {
      // Refresh the page to update membership-based UI
      router.refresh();
    },
    onError: (err) => {
      setError(err.message ?? "Failed to join club");
    },
  });

  return (
    <div className="mt-4">
      <button
        onClick={() => joinMutation.mutate({ id: groupId })}
        className="cute-button"
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending ? "Joining…" : "Join Club"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

