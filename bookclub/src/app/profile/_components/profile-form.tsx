"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export function ProfileForm({ initialText }: { initialText?: string | null }) {
  const [text, setText] = useState(initialText ?? "");
  const [saved, setSaved] = useState<null | "ok" | "error">(null);

  useEffect(() => {
    setText(initialText ?? "");
  }, [initialText]);

  const utils = api.useUtils();
  const mutate = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      setSaved("ok");
      await utils.user.getProfile.invalidate();
      setTimeout(() => setSaved(null), 1500);
    },
    onError: () => setSaved("error"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(null);
        mutate.mutate({ profileText: text });
      }}
      className="space-y-3"
    >
      <textarea
        name="profileText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="I love cozy mysteries, sci‑fi with strong characters, and memoirs. Favorites: The Night Circus, Project Hail Mary, Educated."
        className="w-full rounded-md border border-rose-200 bg-white/60 p-3 text-rose-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="cute-button" disabled={mutate.isPending}>
          {mutate.isPending ? "Saving…" : "Save"}
        </button>
        {saved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
        {saved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
      </div>
    </form>
  );
}

