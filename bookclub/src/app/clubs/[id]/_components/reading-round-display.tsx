"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import confetti from "canvas-confetti";
import type { Options as ConfettiOptions } from "canvas-confetti";

function BookCover({ title, author, coverUrl }: { title: string; author: string; coverUrl?: string | null }) {
  const firstAuthor = author.split(",")[0]?.trim() ?? author;
  const { data } = api.books.getThumbnail.useQuery(
    { title, author: firstAuthor },
    { enabled: !coverUrl && Boolean(title) && Boolean(firstAuthor) },
  );

  const src = coverUrl ?? data?.thumbnail ?? null;

  return (
    <div className="mb-3 w-full overflow-hidden rounded bg-rose-50" style={{ aspectRatio: "3/4" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl">📚</div>
      )}
    </div>
  );
}

export function ReadingRoundDisplay({
  groupId,
  isAdmin,
}: {
  groupId: string;
  isAdmin: boolean;
}) {
  const utils = api.useUtils();
  const { data: round, isLoading } = api.readingRounds.getCurrentRound.useQuery({ groupId });
  const [aiDirection, setAiDirection] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  const createRound = api.readingRounds.createRoundWithRecommendations.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const addUserRec = api.readingRounds.addUserRecommendation.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const startVote = api.readingRounds.startVote.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const submitVote = api.readingRounds.submitVote.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      // Keep selectedChoiceId so the green highlight persists
    },
  });

  const startReading = api.readingRounds.startReading.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      // Trigger confetti when admin starts reading
      const confettiOptions: ConfettiOptions = {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      };
      confetti(confettiOptions);
    },
  });

  const submitRating = api.readingRounds.submitRating.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const submitReview = api.readingRounds.submitReview.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const finishReading = api.readingRounds.finishReading.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  // Show confetti when vote completes and user first sees it
  useEffect(() => {
    if (round?.status === "VOTING" && round.poll && !hasShownConfetti) {
      const now = new Date();
      const endedByTime = round.poll.endsAt ? new Date(round.poll.endsAt) <= now : false;
      const isClosed = round.poll.status === "CLOSED" || endedByTime || round.poll.allVoted;
      
      if (isClosed && round.poll.winnerBookId) {
        // Show confetti when user first sees completed vote
        setHasShownConfetti(true);
        const confettiOptions: ConfettiOptions = {
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        };
        confetti(confettiOptions);
      }
    }
  }, [round, hasShownConfetti]);

  // Initialize selected choice from existing vote
  useEffect(() => {
    if (round?.poll?.myVoteChoiceId) {
      setSelectedChoiceId(round.poll.myVoteChoiceId);
    }
  }, [round?.poll?.myVoteChoiceId]);

  // Initialize rating and review from existing data
  useEffect(() => {
    if (round?.myRating) {
      setRating(round.myRating);
    }
    if (round?.myReview) {
      setReviewText(round.myReview);
    }
  }, [round?.myRating, round?.myReview]);

  const timeLeft = useMemo(() => {
    if (!round?.poll?.endsAt) return null;
    const end = new Date(round.poll.endsAt);
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [round?.poll?.endsAt]);

  if (isLoading) {
    return (
      <section className="cute-card mt-6">
        <p className="text-rose-700/80">Loading...</p>
      </section>
    );
  }

  // State 0: SETUP or no round - empty state
  if (!round || round.status === "SETUP") {
    const poll = round?.poll;
    const hasRecommendations = poll && poll.choices.length > 0;

    return (
      <section className="cute-card mt-6">
        <h2 className="mb-4 text-xl font-bold text-rose-800">Reading Round</h2>

        {!hasRecommendations ? (
          <>
            {isAdmin ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-rose-800">
                    Give the recommendation system some guidance (optional)
                  </label>
                  <textarea
                    value={aiDirection}
                    onChange={(e) => setAiDirection(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 bg-white/90 px-3 py-2 outline-none focus:border-rose-300"
                    placeholder="e.g., 'Focus on science fiction books' or 'Prefer shorter novels this round'"
                    rows={3}
                  />
                </div>
                <button
                  onClick={() => createRound.mutate({ groupId, aiDirection: aiDirection || undefined })}
                  disabled={createRound.isPending}
                  className="cute-button"
                >
                  {createRound.isPending ? "Generating..." : "Generate Recommendations"}
                </button>
              </div>
            ) : (
              <p className="text-rose-700/80">One of your admins must start the next round.</p>
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="mb-2 text-lg font-semibold text-rose-800">Recommendations</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {poll.choices.map((choice: any) => {
                  const book = choice.book;
                  return (
                    <div key={choice.id} className="rounded-lg border border-rose-200 p-3">
                      <BookCover
                        title={book.title}
                        author={book.authors}
                        coverUrl={book.coverImageUrl}
                      />
                      <h4 className="mb-1 font-semibold text-rose-900">{book.title}</h4>
                      <p className="text-sm text-rose-700/80">{book.authors}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const title = window.prompt("Enter book title:");
                    const author = window.prompt("Enter author name:");
                    if (title && author && round) {
                      addUserRec.mutate({
                        readingRoundId: round.id,
                        title: title.trim(),
                        author: author.trim(),
                      });
                    }
                  }}
                  disabled={addUserRec.isPending}
                  className="cute-button-outline"
                >
                  + Add Recommendation
                </button>
                <button
                  onClick={() => startVote.mutate({ readingRoundId: round.id })}
                  disabled={startVote.isPending}
                  className="cute-button"
                >
                  Start Vote
                </button>
              </div>
            )}

            {!isAdmin && (
              <p className="text-rose-700/80">One of your admins must start the vote.</p>
            )}
          </>
        )}
      </section>
    );
  }

  // State 1: VOTING
  if (round.status === "VOTING" && round.poll) {
    const poll = round.poll;
    const now = new Date();
    const endedByTime = poll.endsAt ? new Date(poll.endsAt) <= now : false;
    const isClosed = poll.status === "CLOSED" || endedByTime || poll.allVoted;

    if (isClosed) {
      // Vote is done, show winner and allow admin to start reading
      const winnerChoice = poll.choices.find((c: any) => c.book.id === poll.winnerBookId) ?? poll.choices[0];

      return (
        <section className="cute-card mt-6">
          <h2 className="mb-4 text-xl font-bold text-rose-800">Voting Complete!</h2>
          <div className="mb-4">
            <h3 className="mb-3 text-lg font-semibold text-rose-900">Winner</h3>
            <div className="flex gap-4">
              <div className="h-40 w-28 overflow-hidden rounded bg-rose-50">
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
                <h4 className="text-xl font-bold text-rose-900">{winnerChoice?.book?.title}</h4>
                <p className="text-rose-700/80">{winnerChoice?.book?.authors}</p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => startReading.mutate({ readingRoundId: round.id })}
              disabled={startReading.isPending}
              className="cute-button"
            >
              Start Reading
            </button>
          )}

          {!isAdmin && (
            <p className="text-rose-700/80">Waiting for admin to start reading...</p>
          )}
        </section>
      );
    }

    // Voting is active
    return (
      <section className="cute-card mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-rose-800">Vote for Your Book</h2>
            {timeLeft && (
              <p className="text-rose-700/80">
                Your book club has {timeLeft} more to vote
              </p>
            )}
          </div>
          {isAdmin && (
            <span className="text-sm text-rose-700/70">
              {poll.votes.length}/{poll.memberCount} voted
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {poll.choices.map((choice: any) => {
            const book = choice.book;
            const isSelected = selectedChoiceId === choice.id;
            return (
              <div
                key={choice.id}
                onClick={() => setSelectedChoiceId(choice.id)}
                className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                  isSelected
                    ? "border-green-500 bg-green-50"
                    : "border-rose-200 hover:border-rose-300"
                }`}
              >
                <BookCover
                  title={book.title}
                  author={book.authors}
                  coverUrl={book.coverImageUrl}
                />
                <h4 className="mb-1 font-semibold text-rose-900">{book.title}</h4>
                <p className="text-sm text-rose-700/80">{book.authors}</p>
                {isSelected && (
                  <div className="mt-2 text-sm font-medium text-green-700">✓ Selected</div>
                )}
              </div>
            );
          })}
        </div>

        {selectedChoiceId && (
          <div className="mt-4">
            <button
              onClick={() => submitVote.mutate({ readingRoundId: round.id, choiceId: selectedChoiceId })}
              disabled={submitVote.isPending}
              className="cute-button"
            >
              {submitVote.isPending ? "Casting..." : "Cast Vote"}
            </button>
          </div>
        )}
      </section>
    );
  }

  // State 2: READING
  if (round.status === "READING" && round.book) {
    const book = round.book;
    const reviewCount = round.reviewCount ?? 0;

    return (
      <section className="cute-card mt-6">
        <h2 className="mb-4 text-xl font-bold text-rose-800">Currently Reading</h2>

        <div className="mb-6 flex gap-4">
          <div className="h-48 w-32 overflow-hidden rounded bg-rose-50">
            {book.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">📚</div>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-rose-900">{book.title}</h3>
            <p className="text-rose-700/80">{book.authors}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-rose-800">
              Rate this book
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setRating(num);
                    submitRating.mutate({ readingRoundId: round.id, rating: num });
                  }}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    rating && num <= rating ? "opacity-100" : "opacity-30"
                  }`}
                  title={`${num} star${num !== 1 ? "s" : ""}`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-rose-800">
              Review (optional)
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              onBlur={() => {
                if (reviewText.trim()) {
                  submitReview.mutate({ readingRoundId: round.id, reviewText: reviewText.trim() });
                }
              }}
              className="w-full rounded-xl border border-rose-200 bg-white/90 px-3 py-2 outline-none focus:border-rose-300"
              placeholder="Share your thoughts about this book..."
              rows={4}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <button
              onClick={() => {
                if (
                  confirm(
                    `Finish this round? This will end the review period. ${reviewCount} people have reviewed it.`,
                  )
                ) {
                  finishReading.mutate({ readingRoundId: round.id });
                }
              }}
              disabled={finishReading.isPending}
              className="cute-button-outline"
              title={`This will end the review period. ${reviewCount} people have reviewed it.`}
            >
              {finishReading.isPending ? "Finishing..." : "Finished Reading"}
            </button>
          </div>
        )}
      </section>
    );
  }

  // State 3: FINISHED - should not show here, but handle gracefully
  return null;
}

