"use client";

import { useState } from "react";

export function CopyLinkButton({ clubId }: { clubId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/clubs/${clubId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button onClick={handleCopy} className="cute-button-outline" title="Copy link to invite members">
      {copied ? "✓ Copied!" : "📋 Copy Link"}
    </button>
  );
}

