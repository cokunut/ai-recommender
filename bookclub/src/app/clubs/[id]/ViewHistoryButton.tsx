"use client";

import { useRouter } from "next/navigation";

export function ViewHistoryButton({ clubId }: { clubId: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/clubs/${clubId}/history`)}
      className="cute-button-outline"
    >
      📚 View History
    </button>
  );
}

