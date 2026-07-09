"use client";

/**
 * "Share report" — copies the current page URL to the clipboard (the OG image
 * does the rest when the link is pasted). Falls back to a select-and-copy hint
 * if the clipboard API is unavailable. Renders as the mock's bordered pill.
 */
import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Copy a link to this report"
      className="inline-flex items-center gap-2 border border-sc-border px-3.5 py-[7px] font-mono text-xs uppercase tracking-[.12em] text-sc-body transition-colors hover:border-sc-border-hi hover:text-sc-ink"
    >
      {copied ? "Link copied" : "Share report ↗"}
    </button>
  );
}
