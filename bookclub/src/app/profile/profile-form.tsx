"use client";

import { useEffect, useState } from "react";

const KEY = "profile:text";

export function ProfileForm() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<null | "ok" | "error" | "saving">(null);

  useEffect(() => {
    try {
      const existing = localStorage.getItem(KEY);
      if (existing) setText(existing);
    } catch {}
  }, []);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved("saving");
    try {
      localStorage.setItem(KEY, text);
      setSaved("ok");
      setTimeout(() => setSaved(null), 1500);
    } catch {
      setSaved("error");
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-3">
      <textarea
        name="profileText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="I love cozy mysteries, sci‑fi with strong characters, and memoirs. Favorites: The Night Circus, Project Hail Mary, Educated."
        className="w-full rounded-md border border-rose-200 bg-white/60 p-3 text-rose-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="cute-button" disabled={saved === "saving"}>
          {saved === "saving" ? "Saving…" : "Save"}
        </button>
        {saved === "ok" && <span className="text-sm text-emerald-700">Saved</span>}
        {saved === "error" && <span className="text-sm text-rose-700">Failed to save</span>}
      </div>
    </form>
  );
}

