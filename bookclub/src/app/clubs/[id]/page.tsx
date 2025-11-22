import Link from "next/link";
import { api } from "~/trpc/server";
import { JoinClubButton } from "./_components/join-club-button";
import { ClubRecommendations } from "./_components/club-recommendations";
import { CopyLinkButton } from "./_components/copy-link-button";
import { ViewHistoryButton } from "./_components/view-history-button";
import { DeleteClubButton } from "./_components/delete-club-button";
import { LeaveClubButton } from "./_components/leave-club-button";

export default async function ClubDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await api.clubs.byId({ id });
  const isMember = await api.clubs.isMember({ id });
  const members = await api.clubs.members({ id });
  const userRole = isMember ? await api.clubs.myRole({ id }) : null;
  const isOwnerOrAdmin = userRole === "OWNER" || userRole === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/clubs">← Back to clubs</Link>
      </nav>
      <section className="cute-card">
        <h1 className="mb-2 text-2xl font-bold text-rose-800">{group?.name ?? "Club details"}</h1>
        <p className="text-rose-700/80">{group?.description ?? `club details here (id: ${id})`}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isMember ? (
            <JoinClubButton groupId={id} />
          ) : (
            <>
              <CopyLinkButton clubId={id} />
              <ViewHistoryButton clubId={id} />
            </>
          )}
        </div>
      </section>
      <section className="cute-card mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-rose-800">Members</h2>
          <span className="text-sm text-rose-700/70">{members.length} member{members.length === 1 ? "" : "s"}</span>
        </div>
        {members.length === 0 ? (
          <p className="text-rose-700/80">No members yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded border border-rose-200 p-2">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-rose-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.user?.image || m.user?.avatarUrl ? (
                    <img src={(m.user.image ?? m.user.avatarUrl) as string} alt={m.user?.name ?? "Member"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-rose-700">👤</div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-rose-900">{m.user?.name ?? "Member"}</div>
                  <div className="text-xs uppercase tracking-wide text-rose-600">{m.role}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isMember ? <ClubRecommendations groupId={id} /> : null}
      {isMember ? (
        <section className="cute-card mt-6">
          <div className="flex items-center gap-3">
            <LeaveClubButton clubId={id} userRole={userRole} members={members} />
            {isOwnerOrAdmin && <DeleteClubButton clubId={id} />}
          </div>
        </section>
      ) : null}
    </main>
  );
}
