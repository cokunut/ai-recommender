"use client";

import { api } from "~/trpc/react";
import { useState } from "react";

type HistoryItem = {
  id: string;
  book: {
    id: string;
    title: string;
    authors: string;
    coverImageUrl: string | null;
  } | null;
  finishedAt: Date | null;
  avgRating: number | null;
  ratingCount: number;
  aiGroupReview: string | null;
  myRating: number | null;
  myReview: string | null;
};

export function HistoryList({ history: initialHistory, clubId }: { history: HistoryItem[]; clubId: string }) {
  const utils = api.useUtils();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  
  // Use client-side query for reactive updates
  const { data: history = initialHistory } = api.clubs.history.useQuery(
    { id: clubId },
    { initialData: initialHistory }
  );

  const generateReview = api.clubs.generateGroupReview.useMutation({
    onSuccess: async () => {
      await utils.clubs.history.refetch({ id: clubId });
      setGeneratingFor(null);
    },
    onError: () => {
      setGeneratingFor(null);
    },
  });

  const handleGenerateReview = (roundId: string) => {
    setGeneratingFor(roundId);
    generateReview.mutate({ readingRoundId: roundId });
  };

  return (
    <div className="mt-6 space-y-6">
      {history.map((item) => (
        <div key={item.id} className="cute-card">
          {item.book ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Book Cover */}
              <div className="flex-shrink-0">
                {item.book.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.book.coverImageUrl}
                    alt={`${item.book.title} cover`}
                    className="h-48 w-32 rounded border border-rose-200 object-cover sm:h-64 sm:w-40"
                  />
                ) : (
                  <div className="flex h-48 w-32 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-400 sm:h-64 sm:w-40">
                    📚
                  </div>
                )}
              </div>

              {/* Book Info and Reviews */}
              <div className="flex-1 space-y-4">
                {/* Title and Date */}
                <div>
                  <h2 className="text-xl font-bold text-rose-800">{item.book.title}</h2>
                  <p className="text-rose-700/70">{item.book.authors}</p>
                  {item.finishedAt && (
                    <div className="mt-2 inline-block rounded-full border border-rose-200 bg-rose-50 px-3 py-1">
                      <span className="text-sm font-medium text-rose-700">
                        Finished {new Date(item.finishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Average Group Rating */}
                {item.avgRating !== null && (
                  <div className="rounded border border-rose-200 bg-rose-50/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-rose-700">Group Rating:</span>
                      <span className="text-lg font-bold text-rose-800">
                        {item.avgRating.toFixed(1)} ⭐
                      </span>
                      <span className="text-sm text-rose-600/70">
                        ({item.ratingCount} {item.ratingCount === 1 ? "rating" : "ratings"})
                      </span>
                    </div>
                  </div>
                )}

                {/* AI-Synthesized Group Review */}
                <div className="rounded border border-rose-200 bg-rose-50/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-rose-800">Group Review</h3>
                    {!item.aiGroupReview && (
                      <button
                        onClick={() => handleGenerateReview(item.id)}
                        disabled={generatingFor === item.id || item.ratingCount === 0}
                        className="text-sm text-rose-600 hover:text-rose-700 disabled:opacity-50"
                      >
                        {generatingFor === item.id ? "Generating..." : "Generate Review"}
                      </button>
                    )}
                  </div>
                  {item.aiGroupReview ? (
                    <p className="text-rose-700/80 whitespace-pre-wrap">{item.aiGroupReview}</p>
                  ) : (
                    <p className="text-rose-600/60 italic">
                      {item.ratingCount === 0
                        ? "No reviews yet to synthesize."
                        : "Click 'Generate Review' to create an AI-synthesized review from member reviews."}
                    </p>
                  )}
                </div>

                {/* Your Rating and Review */}
                <div className="space-y-2 rounded border border-rose-200 bg-white p-4">
                  <h3 className="font-semibold text-rose-800">Your Review</h3>
                  {item.myRating !== null && (
                    <div className="text-rose-700">
                      <span className="font-medium">Your Rating: </span>
                      <span className="text-lg font-bold">{item.myRating} ⭐</span>
                    </div>
                  )}
                  {item.myReview ? (
                    <p className="text-rose-700/80 whitespace-pre-wrap">{item.myReview}</p>
                  ) : (
                    <p className="text-rose-600/60 italic">You haven't written a review yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-rose-700/80">Book information not available.</p>
          )}
        </div>
      ))}
    </div>
  );
}

