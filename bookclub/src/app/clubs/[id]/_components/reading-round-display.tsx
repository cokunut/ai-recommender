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
  const { data: currentUser } = api.user.getProfile.useQuery();
  const [aiDirection, setAiDirection] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [savedReviewText, setSavedReviewText] = useState<string>("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState<null | "ok" | "error">(null);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const [hasStartedReading, setHasStartedReading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [deletingChoiceId, setDeletingChoiceId] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const createRound = api.readingRounds.createRoundWithRecommendations.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const addUserRec = api.readingRounds.addUserRecommendation.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      setNewBookTitle("");
      setNewBookAuthor("");
      setShowAddForm(false);
    },
  });

  const deleteRec = api.readingRounds.deleteRecommendation.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      setDeletingChoiceId(null);
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
      setHasStartedReading(true);
    },
  });

  const submitRating = api.readingRounds.submitRating.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
    },
  });

  const submitReview = api.readingRounds.submitReview.useMutation({
    onSuccess: (_, variables) => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      setSavedReviewText(variables.reviewText);
      setReviewSaved("ok");
      // If text was cleared, stay in edit mode (no text to display)
      if (!variables.reviewText || variables.reviewText.trim().length === 0) {
        setIsEditingReview(true);
      } else {
        setIsEditingReview(false);
      }
      setTimeout(() => setReviewSaved(null), 1500);
    },
    onError: () => {
      setReviewSaved("error");
      setTimeout(() => setReviewSaved(null), 1500);
    },
  });

  const finishReading = api.readingRounds.finishReading.useMutation({
    onSuccess: () => {
      utils.readingRounds.getCurrentRound.invalidate({ groupId });
      setShowFinishConfirm(false);
    },
  });

  // Reset confetti and reading state when round changes
  useEffect(() => {
    setHasShownConfetti(false);
    setHasStartedReading(false);
  }, [round?.id]);

  // Show confetti when vote completes and automatically start reading
  useEffect(() => {
    if (round?.status === "VOTING" && round.poll && !hasShownConfetti && !hasStartedReading) {
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
        
        // Automatically start reading after a short delay (to let confetti show)
        setTimeout(() => {
          if (round.id && !hasStartedReading) {
            startReading.mutate({ readingRoundId: round.id });
          }
        }, 1500);
      }
    }
  }, [round, hasShownConfetti, hasStartedReading, startReading]);

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
      setSavedReviewText(round.myReview);
      setIsEditingReview(false);
    } else {
      setIsEditingReview(true);
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
                  const canDelete = isAdmin || (choice.addedBy?.id === currentUser?.id);
                  const isDeleting = deletingChoiceId === choice.id;
                  return (
                    <div key={choice.id} className="relative rounded-lg border border-rose-200 p-3">
                      {canDelete && !isDeleting && (
                        <button
                          onClick={() => setDeletingChoiceId(choice.id)}
                          disabled={deleteRec.isPending}
                          className="absolute right-2 top-2 rounded bg-rose-100 p-1.5 text-lg leading-none text-rose-700 hover:bg-rose-200"
                          title="Delete recommendation"
                        >
                          ×
                        </button>
                      )}
                      {isDeleting && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/95 p-3">
                          <p className="mb-3 text-sm font-medium text-rose-800">
                            Delete this recommendation?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                deleteRec.mutate({
                                  readingRoundId: round.id,
                                  choiceId: choice.id,
                                });
                              }}
                              disabled={deleteRec.isPending}
                              className="rounded bg-rose-600 px-3 py-1 text-sm text-white hover:bg-rose-700"
                            >
                              {deleteRec.isPending ? "Deleting..." : "Delete"}
                            </button>
                            <button
                              onClick={() => setDeletingChoiceId(null)}
                              disabled={deleteRec.isPending}
                              className="rounded border border-rose-300 bg-white px-3 py-1 text-sm text-rose-700 hover:bg-rose-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
              <div className="space-y-3">
                {!showAddForm ? (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="cute-button-outline"
                  >
                    + Add Recommendation
                  </button>
                ) : (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-rose-800">
                          Book Title
                        </label>
                        <input
                          type="text"
                          value={newBookTitle}
                          onChange={(e) => setNewBookTitle(e.target.value)}
                          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 outline-none focus:border-rose-300"
                          placeholder="Enter book title"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-rose-800">
                          Author
                        </label>
                        <input
                          type="text"
                          value={newBookAuthor}
                          onChange={(e) => setNewBookAuthor(e.target.value)}
                          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 outline-none focus:border-rose-300"
                          placeholder="Enter author name"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (newBookTitle.trim() && newBookAuthor.trim() && round) {
                            addUserRec.mutate({
                              readingRoundId: round.id,
                              title: newBookTitle.trim(),
                              author: newBookAuthor.trim(),
                            });
                          }
                        }}
                        disabled={addUserRec.isPending || !newBookTitle.trim() || !newBookAuthor.trim()}
                        className="cute-button"
                      >
                        {addUserRec.isPending ? "Adding..." : "Add"}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setNewBookTitle("");
                          setNewBookAuthor("");
                        }}
                        className="cute-button-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
      // Vote is done, show winner briefly before transitioning to reading
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
          {startReading.isPending && (
            <p className="text-rose-700/80">Starting reading round...</p>
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
            {!isEditingReview && savedReviewText.trim().length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-md border border-rose-200 bg-white/60 p-3 text-sm text-rose-900 whitespace-pre-wrap min-h-[80px]">
                  {savedReviewText}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingReview(true)}
                    className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setReviewSaved(null);
                      setReviewText("");
                      setSavedReviewText("");
                      submitReview.mutate({ readingRoundId: round.id, reviewText: "" });
                    }}
                    disabled={submitReview.isPending}
                    className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitReview.isPending ? "Clearing…" : "Clear"}
                  </button>
                  {reviewSaved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
                  {reviewSaved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full rounded-md border border-rose-200 bg-white/60 p-3 text-sm text-rose-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                  placeholder="Share your thoughts about this book..."
                  rows={4}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setReviewSaved(null);
                      submitReview.mutate({ readingRoundId: round.id, reviewText: reviewText.trim() });
                    }}
                    disabled={submitReview.isPending || reviewText.trim().length === 0}
                    className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-400 disabled:hover:border-rose-400"
                  >
                    {submitReview.isPending ? "Saving…" : "Save"}
                  </button>
                  {savedReviewText.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewText(savedReviewText);
                        setIsEditingReview(false);
                        setReviewSaved(null);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.99]"
                    >
                      Cancel
                    </button>
                  )}
                  {reviewSaved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
                  {reviewSaved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            {!showFinishConfirm ? (
              <button
                onClick={() => setShowFinishConfirm(true)}
                disabled={finishReading.isPending}
                className="cute-button-outline"
              >
                End Round
              </button>
            ) : (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
                <p className="mb-3 text-sm font-medium text-rose-800">
                  Finish this round? This will end the review period. {reviewCount} people have reviewed it.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      finishReading.mutate({ readingRoundId: round.id });
                    }}
                    disabled={finishReading.isPending}
                    className="rounded bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
                  >
                    {finishReading.isPending ? "Finishing..." : "Finish Round"}
                  </button>
                  <button
                    onClick={() => setShowFinishConfirm(false)}
                    disabled={finishReading.isPending}
                    className="rounded border border-rose-300 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // State 3: FINISHED - should not show here, but handle gracefully
  return null;
}

