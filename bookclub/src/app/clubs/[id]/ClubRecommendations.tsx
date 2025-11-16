"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";

export function ClubRecommendations({ groupId }: { groupId: string }) {
  const utils = api.useUtils();
  const { data: poll, isLoading, isFetching } = api.clubs.getActivePoll.useQuery({ id: groupId });
  const gen = api.clubs.generateRecs.useMutation({
    onSuccess: () => utils.clubs.getActivePoll.invalidate({ id: groupId }),
  });
  const voteMut = api.clubs.vote.useMutation({
    onSuccess: () => utils.clubs.getActivePoll.invalidate({ id: groupId }),
  });

  const timeLeft = useMemo(() => {
    if (!poll?.endsAt) return null;
    const end = new Date(poll.endsAt as unknown as string);
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  }, [poll?.endsAt]);

  if (isLoading || isFetching) {
    return (
      <section className="cute-card mt-6">
        <p className="text-rose-700/80">Loading recommendations…</p>
      </section>
    );
  }

  if (!poll) {
    return (
      <section className="cute-card mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-rose-800">Recommendations</h2>
            <p className="text-rose-700/80">Generate 3 book picks for this club.</p>
          </div>
          <button
            onClick={() => gen.mutate({ id: groupId })}
            disabled={gen.isPending}
            className="cute-button"
          >
            {gen.isPending ? "Generating…" : "Generate recommendations"}
          </button>
        </div>
      </section>
    );
  }

  const isClosed = poll.status === "CLOSED" || poll.endedByTime || poll.allVoted;

  const winnerChoice = isClosed
    ? poll.choices.find((c: any) => c.book.id === poll.winnerBookId) ?? poll.choices[0]
    : null;

  return (
    <section className="cute-card mt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-rose-800">Recommendations</h2>
          <p className="text-rose-700/80">
            {isClosed ? "Voting closed" : timeLeft ?? ""}
            {!isClosed && poll.memberCount ? ` • ${poll.votes.length}/${poll.memberCount} voted` : null}
          </p>
        </div>
        {!isClosed ? null : (
          <span className="rounded bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700">
            Winner Selected
          </span>
        )}
      </div>

      {!isClosed ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {poll.choices.map((choice: any) => {
            const book = choice.book;
            const votes = choice.votes.length;
            const isMine = poll.myVoteChoiceId === choice.id;
            return (
              <div key={choice.id} className="rounded-lg border border-rose-200 p-3">
                <div className="mb-2 aspect-[3/4] w-full overflow-hidden rounded bg-rose-50">
                  {book.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">📚</div>
                  )}
                </div>
                <h3 className="mb-1 font-semibold text-rose-900">{book.title}</h3>
                <p className="mb-3 text-sm text-rose-700/80">Why recommended: A great pick for this club’s vibe. (placeholder)</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Thumbs up"
                      className={`rounded px-2 py-1 ${isMine ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700"}`}
                      onClick={() => voteMut.mutate({ pollId: poll.id, choiceId: choice.id, action: "up" })}
                      disabled={voteMut.isPending}
                    >
                      👍
                    </button>
                    <button
                      aria-label="Thumbs down"
                      className="rounded bg-rose-100 px-2 py-1 text-rose-700"
                      onClick={() => voteMut.mutate({ pollId: poll.id, choiceId: choice.id, action: "down" })}
                      disabled={voteMut.isPending}
                    >
                      👎
                    </button>
                  </div>
                  <span className="text-sm text-rose-700/80">{votes} vote{votes === 1 ? "" : "s"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-rose-900">Winner</h3>
          <div className="flex gap-4">
            <div className="h-28 w-20 overflow-hidden rounded bg-rose-50">
              {winnerChoice?.book?.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={winnerChoice.book.coverImageUrl}
                  alt={winnerChoice.book.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl">📚</div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-rose-600">Selected Book</p>
              <h4 className="text-xl font-bold text-rose-900">{winnerChoice?.book?.title ?? poll.choices[0]?.book?.title}</h4>
              <p className="text-rose-700/80">Voting has ended. Enjoy your next read!</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

