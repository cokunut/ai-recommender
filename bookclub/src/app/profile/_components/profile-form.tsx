"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

const MAX_CHARACTERS = 500;

export function ProfileForm({
  initialText,
  redirectOnSave,
  alwaysEditing = false,
}: {
  initialText?: string | null;
  redirectOnSave?: string;
  alwaysEditing?: boolean;
}) {
  const [text, setText] = useState(initialText ?? "");
  // If alwaysEditing is true (setup page), always show edit mode
  // Otherwise, only show edit mode if there's no initial text
  const [isEditing, setIsEditing] = useState(alwaysEditing || !initialText || initialText.trim().length === 0);
  const [saved, setSaved] = useState<null | "ok" | "error">(null);
  const router = useRouter();

  useEffect(() => {
    setText(initialText ?? "");
    if (!alwaysEditing) {
      setIsEditing(!initialText || initialText.trim().length === 0);
    }
  }, [initialText, alwaysEditing]);

  const utils = api.useUtils();
  const mutate = api.user.updateProfile.useMutation({
    onSuccess: async (data) => {
      setSaved("ok");
      setText(data.profileText ?? "");
      // If text was cleared, switch to edit mode (no text to display)
      if (!data.profileText || data.profileText.trim().length === 0) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
      await utils.user.getProfile.invalidate();
      if (redirectOnSave) {
        // Wait a moment to show "Saved" message, then redirect
        setTimeout(() => {
          router.push(redirectOnSave);
        }, 500);
      } else {
        setTimeout(() => setSaved(null), 1500);
      }
    },
    onError: () => setSaved("error"),
  });

  const characterCount = text.length;
  const isAtLimit = characterCount >= MAX_CHARACTERS;

  // View mode: show text with Edit button (only if not alwaysEditing and has text)
  if (!alwaysEditing && !isEditing && text.trim().length > 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-rose-200 bg-white/60 p-3 text-sm text-rose-900 whitespace-pre-wrap min-h-[80px]">
          {text}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={async () => {
              setSaved(null);
              mutate.mutate({ profileText: "" });
            }}
            disabled={mutate.isPending}
            className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutate.isPending ? "Clearing…" : "Clear"}
          </button>
          {saved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
          {saved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
        </div>
      </div>
    );
  }

  // Edit mode: show textarea with Save button

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(null);
        mutate.mutate({ profileText: text });
      }}
      className="space-y-3"
    >
      <div className="relative">
        <textarea
          name="profileText"
          value={text}
          onChange={(e) => {
            const newText = e.target.value;
            if (newText.length <= MAX_CHARACTERS) {
              setText(newText);
            }
          }}
          rows={4}
          placeholder="I love cozy mysteries, sci‑fi with strong characters, and memoirs. Favorites: The Night Circus, Project Hail Mary, Educated."
          className="w-full rounded-md border border-rose-200 bg-white/60 p-3 text-sm text-rose-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
          maxLength={MAX_CHARACTERS}
        />
        <div className="absolute bottom-2 right-2 text-xs text-rose-500/70">
          {characterCount}/{MAX_CHARACTERS}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full border border-rose-400 bg-rose-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 hover:border-rose-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-400 disabled:hover:border-rose-400"
          disabled={mutate.isPending || text.trim().length === 0}
        >
          {mutate.isPending ? "Saving…" : "Save"}
        </button>
        {!redirectOnSave && text.trim().length > 0 && (
          <button
            type="button"
            onClick={() => {
              setText(initialText ?? "");
              setIsEditing(false);
              setSaved(null);
            }}
            className="cute-button-outline text-sm"
          >
            Cancel
          </button>
        )}
        {saved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
        {saved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
      </div>
    </form>
  );
}

