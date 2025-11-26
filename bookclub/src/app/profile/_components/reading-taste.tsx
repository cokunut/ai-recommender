"use client";

import { useState } from "react";

type PreferenceTag = {
  id: string;
  label: string;
  source: "ai" | "user";
  preference: "like" | "dislike";
};

// Mock data for UI preview
const mockTags: PreferenceTag[] = [
  { id: "1", label: "character-driven fantasy", source: "ai", preference: "like" },
  { id: "2", label: "found family", source: "ai", preference: "like" },
  { id: "3", label: "coming-of-age", source: "ai", preference: "like" },
  { id: "4", label: "low romance", source: "ai", preference: "like" },
  { id: "5", label: "cozy", source: "user", preference: "like" },
  { id: "6", label: "short books", source: "user", preference: "like" },
  { id: "7", label: "queer protagonists", source: "user", preference: "like" },
  { id: "8", label: "smut", source: "user", preference: "dislike" },
  { id: "9", label: "tragic endings", source: "user", preference: "dislike" },
  { id: "10", label: "Matt Haig", source: "ai", preference: "dislike" },
];

export function ReadingTaste({ hasGoodreadsImport = true }: { hasGoodreadsImport?: boolean }) {
  const [taste, setTaste] = useState<{ tags: PreferenceTag[] } | null>(null);
  const [savingTaste, setSavingTaste] = useState(false);
  const [resettingTaste, setResettingTaste] = useState(false);
  const [errorTaste, setErrorTaste] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingDislike, setIsAddingDislike] = useState(false);

  const deleteTag = (tagId: string) => {
    if (!taste) return;
    setTaste({
      tags: taste.tags.filter((tag) => tag.id !== tagId),
    });
  };

  const addTag = (preference: "like" | "dislike") => {
    const trimmed = newTagInput.trim();
    if (!trimmed) {
      setIsAddingTag(false);
      setIsAddingDislike(false);
      setNewTagInput("");
      return;
    }

    // Initialize taste if it doesn't exist
    if (!taste) {
      const newTag: PreferenceTag = {
        id: crypto.randomUUID(),
        label: trimmed,
        source: "user",
        preference,
      };
      setTaste({ tags: [newTag] });
      setIsAddingTag(false);
      setIsAddingDislike(false);
      setNewTagInput("");
      return;
    }

    // Check for duplicates (case-insensitive) across all tags
    const isDuplicate = taste.tags.some(
      (tag) => tag.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setIsAddingTag(false);
      setIsAddingDislike(false);
      setNewTagInput("");
      return;
    }

    // Add new tag
    const newTag: PreferenceTag = {
      id: crypto.randomUUID(),
      label: trimmed,
      source: "user",
      preference,
    };
    setTaste({
      tags: [...taste.tags, newTag],
    });
    setIsAddingTag(false);
    setIsAddingDislike(false);
    setNewTagInput("");
  };

  const generateTags = () => {
    // Mock generate - show the mock tags
    setResettingTaste(true);
    setErrorTaste(null);
    setTimeout(() => {
      setTaste({ tags: mockTags });
      setResettingTaste(false);
    }, 1000);
  };

  const saveTags = async () => {
    if (!taste) return;
    // Mock save - just simulate loading
    setSavingTaste(true);
    setErrorTaste(null);
    setTimeout(() => {
      setSavingTaste(false);
      // Simulate success - in real version, would show success message
    }, 1000);
  };

  const resetFromGoodreads = async () => {
    // Mock reset - just simulate loading
    setResettingTaste(true);
    setErrorTaste(null);
    setTimeout(() => {
      // Reset to AI tags only (likes only, no dislikes from AI)
      setTaste({
        tags: mockTags.filter((tag) => tag.source === "ai" && tag.preference === "like"),
      });
      setResettingTaste(false);
    }, 1000);
  };

  const isDisabled = savingTaste || resettingTaste;


  if (!taste) {
    return (
      <section className="cute-card mb-6">
        <h2 className="mb-3 text-xl font-semibold text-rose-800">Your Reading Taste</h2>
        <p className="mb-4 text-sm text-rose-700/80">
          Generate tags from your description or Goodreads list above. Edit them to better reflect what you like to read. We use them when recommending books.
        </p>
        {hasGoodreadsImport ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={generateTags}
              disabled={resettingTaste}
              className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resettingTaste ? "Generating…" : "Generate Tags"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-rose-700/70">
            Import your Goodreads list to generate tags, or add tags manually below.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="cute-card mb-6">
      <h2 className="mb-3 text-xl font-semibold text-rose-800">Your Reading Taste</h2>
      <p className="mb-4 text-sm text-rose-700/80">
        These tags are generated from your description + Goodreads list. Edit them to better reflect what you like to read. We use them when recommending books.
      </p>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-rose-800">Likes</label>
        <div className="flex flex-wrap gap-2">
          {taste.tags
            .filter((tag) => tag.preference === "like")
            .map((tag) => (
              <div
                key={tag.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                  tag.source === "ai"
                    ? "bg-[#ffe4ec] text-[#b21f4b]"
                    : "border border-[#f3a4b7] bg-white text-[#b21f4b]"
                }`}
              >
                {tag.source === "ai" && <span className="text-xs">✨</span>}
                <span>{tag.label}</span>
                <button
                  type="button"
                  onClick={() => deleteTag(tag.id)}
                  disabled={isDisabled}
                  className="ml-0.5 hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete ${tag.label}`}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          {!isAddingTag ? (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              disabled={isDisabled}
              className="inline-flex items-center rounded-full border border-[#f3a4b7] bg-white px-3 py-1.5 text-sm font-medium text-[#b21f4b] hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add tag
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f3a4b7] bg-white px-3 py-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("like");
                  } else if (e.key === "Escape") {
                    setIsAddingTag(false);
                    setNewTagInput("");
                  }
                }}
                autoFocus
                className="w-32 border-none bg-transparent text-sm text-[#b21f4b] outline-none placeholder:text-rose-400"
                placeholder="Tag name"
              />
              <button
                type="button"
                onClick={() => addTag("like")}
                className="text-sm font-medium text-[#b21f4b] hover:opacity-70"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-rose-800">Dislikes</label>
        <p className="mb-2 text-xs text-rose-700/70">
          Things you want to avoid in book recommendations
        </p>
        <div className="flex flex-wrap gap-2">
          {taste.tags
            .filter((tag) => tag.preference === "dislike")
            .map((tag) => (
              <div
                key={tag.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                  tag.source === "ai"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "border border-rose-400 bg-white text-rose-800"
                }`}
              >
                {tag.source === "ai" && <span className="text-xs">✨</span>}
                <span>{tag.label}</span>
                <button
                  type="button"
                  onClick={() => deleteTag(tag.id)}
                  disabled={isDisabled}
                  className="ml-0.5 hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete ${tag.label}`}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          {!isAddingDislike ? (
            <button
              type="button"
              onClick={() => setIsAddingDislike(true)}
              disabled={isDisabled}
              className="inline-flex items-center rounded-full border border-rose-400 bg-white px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add dislike
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400 bg-white px-3 py-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("dislike");
                  } else if (e.key === "Escape") {
                    setIsAddingDislike(false);
                    setNewTagInput("");
                  }
                }}
                autoFocus
                className="w-32 border-none bg-transparent text-sm text-rose-800 outline-none placeholder:text-rose-400"
                placeholder="Tag name"
              />
              <button
                type="button"
                onClick={() => addTag("dislike")}
                className="text-sm font-medium text-rose-800 hover:opacity-70"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {errorTaste && (
        <div className="mb-4 rounded-md bg-rose-50 p-2 text-sm text-rose-700">{errorTaste}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveTags}
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingTaste ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={resetFromGoodreads}
          disabled={isDisabled || !hasGoodreadsImport}
          className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          title={!hasGoodreadsImport ? "Import your Goodreads list first." : undefined}
        >
          {resettingTaste ? "Resetting…" : "Reset from Goodreads"}
        </button>
      </div>
    </section>
  );
}

