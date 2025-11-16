"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";

export default function TestRecommendationsPage() {
  const [groupId, setGroupId] = useState("");
  const [model, setModel] = useState<string>("llama-3.3-70b-versatile");
  
  const clubsQuery = api.clubs.list.useQuery();
  const generateMutation = api.readingRounds.generateBookRecommendations.useMutation({
    onError: (error) => {
      console.error("Mutation error:", error);
    },
    onSuccess: (data) => {
      console.log("Mutation success:", data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) {
      console.error("No groupId provided");
      return;
    }
    
    console.log("Submitting with:", { groupId, model });
    generateMutation.mutate({
      groupId,
      model,
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-4 text-sm text-rose-700/70">
        <Link href="/">← Home</Link>
      </nav>
      
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-rose-800">Test Book Recommendations</h1>
        <p className="text-rose-700/70">Generate AI-powered book recommendations for a club</p>
      </header>

      <section className="cute-card mb-6">
        <h2 className="mb-3 text-xl font-semibold text-rose-800">Select Club</h2>
        
        {clubsQuery.isLoading && <p className="text-rose-700/70">Loading clubs...</p>}
        {clubsQuery.error && (
          <p className="text-rose-700">Error: {clubsQuery.error.message}</p>
        )}
        
        {clubsQuery.data && clubsQuery.data.length === 0 && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <p className="mb-2">No clubs found. Create one first:</p>
            <Link href="/clubs/new" className="text-rose-600 underline hover:text-rose-800">
              Create a new club →
            </Link>
          </div>
        )}

        {clubsQuery.data && clubsQuery.data.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-rose-700/80">Your clubs:</p>
            {clubsQuery.data.map((club) => (
              <button
                key={club.id}
                onClick={() => setGroupId(club.id)}
                className={`block w-full rounded-md border p-3 text-left transition-colors ${
                  groupId === club.id
                    ? "border-rose-400 bg-rose-50"
                    : "border-rose-200 bg-white hover:bg-rose-50"
                }`}
              >
                <div className="font-semibold text-rose-800">{club.name}</div>
                <div className="text-xs text-rose-600">{club.id}</div>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="groupId" className="mb-1 block text-sm font-medium text-rose-800">
              Group ID (or paste manually)
            </label>
            <input
              id="groupId"
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Enter group ID"
              className="w-full rounded-md border border-rose-200 bg-white/60 p-2 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
              required
            />
          </div>

          <div>
            <label htmlFor="model" className="mb-1 block text-sm font-medium text-rose-800">
              Model
            </label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama-3.3-70b-versatile"
              className="w-full rounded-md border border-rose-200 bg-white/60 p-2 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <p className="mt-1 text-xs text-rose-600">
              Default: llama-3.3-70b-versatile. Other options: llama-3.1-8b-instant (faster). Run <code className="bg-rose-100 px-1 rounded">bun check-groq-models.mjs</code> to see all models.
            </p>
          </div>

          <button
            type="submit"
            disabled={generateMutation.isPending || !groupId}
            className="cute-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateMutation.isPending ? "Generating..." : "Generate Recommendations"}
          </button>
          
          {!groupId && (
            <p className="text-xs text-amber-600 mt-1">
              Please select a club or enter a group ID above
            </p>
          )}
          
          {generateMutation.isPending && (
            <p className="text-sm text-rose-600 mt-2">
              ⏳ Generating recommendations... This may take a few seconds.
            </p>
          )}
        </form>
      </section>

      {generateMutation.error && (
        <section className="cute-card mb-6 rounded-md border-rose-300 bg-rose-50">
          <h2 className="mb-2 text-lg font-semibold text-rose-800">Error</h2>
          <p className="text-rose-700">{generateMutation.error.message}</p>
          {generateMutation.error.message.includes("GROQ_API_KEY") && (
            <p className="mt-2 text-sm text-rose-600">
              Make sure GROQ_API_KEY is set in your .env file
            </p>
          )}
        </section>
      )}

      {generateMutation.data && (
        <section className="cute-card">
          <h2 className="mb-4 text-xl font-semibold text-rose-800">Recommendations</h2>
          
          <div className="mb-4 text-sm text-rose-700/80">
            <p>Group: <span className="font-semibold">{generateMutation.data.context.groupName}</span></p>
            <p>Members: <span className="font-semibold">{generateMutation.data.context.memberCount}</span></p>
            <p>Model: <span className="font-semibold">{generateMutation.data.context.model}</span></p>
          </div>

          <div className="space-y-6">
            {generateMutation.data.recommendations.map((book, idx) => (
              <div key={idx} className="rounded-md border border-rose-200 bg-white/60 p-4">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-rose-800">{book.title}</h3>
                  <p className="text-sm text-rose-600">by {book.author}</p>
                </div>
                {book.reasoning && (
                  <p className="text-sm text-rose-700/80">{book.reasoning}</p>
                )}
              </div>
            ))}
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-rose-700 hover:text-rose-800">
              View Raw JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-rose-50 p-3 text-xs">
              {JSON.stringify(generateMutation.data, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}

