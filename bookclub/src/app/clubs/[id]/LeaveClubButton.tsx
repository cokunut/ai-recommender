"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function LeaveClubButton({ clubId, userRole, members }: { clubId: string; userRole: string | null; members: Array<{ id: string; userId?: string; user: { id: string; name: string | null } }> }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: currentUser } = api.user.getProfile.useQuery();
  const otherMembers = members.filter((m) => (m.userId ?? m.user.id) !== currentUser?.id);

  const leaveMutation = api.clubs.leave.useMutation({
    onSuccess: () => {
      router.push("/clubs");
    },
    onError: (err) => {
      setError(err.message ?? "Failed to leave club");
      setShowConfirm(false);
    },
  });

  const handleLeave = () => {
    if ((userRole === "OWNER" || userRole === "ADMIN") && !transferToUserId) {
      setError("Please select a member to transfer admin rights to");
      return;
    }
    leaveMutation.mutate({
      id: clubId,
      transferToUserId: transferToUserId || undefined,
    });
  };

  if (showConfirm) {
    const needsTransfer = userRole === "OWNER" || userRole === "ADMIN";

    return (
      <div className="flex flex-col gap-2">
        {needsTransfer ? (
          <>
            <p className="text-sm text-rose-700/80">
              You are the {userRole === "OWNER" ? "owner" : "admin"} of this club. Please select a member to transfer your role to:
            </p>
            {otherMembers.length === 0 ? (
              <p className="text-sm text-rose-600">No other members available. You cannot leave as the only admin.</p>
            ) : (
              <select
                value={transferToUserId}
                onChange={(e) => setTransferToUserId(e.target.value)}
                className="rounded border border-rose-200 bg-white px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
              >
                <option value="">Select a member...</option>
                {otherMembers.map((m) => (
                  <option key={m.id} value={m.userId ?? m.user.id}>
                    {m.user.name ?? "Member"}
                  </option>
                ))}
              </select>
            )}
          </>
        ) : (
          <p className="text-sm text-rose-700/80">Are you sure you want to leave this club?</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            disabled={leaveMutation.isPending || (needsTransfer && (!transferToUserId || otherMembers.length === 0))}
            className="cute-button bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
          >
            {leaveMutation.isPending ? "Leaving…" : "Yes, Leave"}
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              setError(null);
              setTransferToUserId("");
            }}
            className="cute-button-outline"
            disabled={leaveMutation.isPending}
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
      className="cute-button-outline text-rose-600 hover:bg-rose-50"
    >
      🚪 Leave Club
    </button>
  );
}

