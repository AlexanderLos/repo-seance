"use client";

/**
 * Interrogation placement (SPEC §6). A thin positioning wrapper around the frozen
 * `<Interrogation>` (components/chat), which owns ALL of the séance chrome — its
 * single header + subtitle, the mobile launcher, and the one full-height sheet.
 * This wrapper deliberately adds no header, border, or sheet of its own, so the
 * report shows exactly ONE "Interrogation" heading and one control layer (it used
 * to nest a second header/sheet around the chat, forcing two taps to the input).
 *
 * Desktop (lg): the wrapper is the fixed 396px right-rail grid cell; the chat's
 * own bordered <section> fills it. Mobile: an in-flow "Speak with the ghost"
 * trigger ends the single-column case file and reveals the chat's launcher, which
 * opens the sheet — no duplicated header, no nested second sheet.
 */
import { useState } from "react";
import { Interrogation } from "@/components/chat/interrogation";
import { cn } from "../util/cn";

export function InterrogationPanel({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  // Mobile only: the case file ends with a single in-flow trigger rather than a
  // floating launcher until the visitor asks for the ghost. Tapping it reveals
  // the chat's own launcher/sheet. On desktop the rail is always shown via `md:`,
  // so this state is irrelevant there.
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="flex w-full items-center justify-center gap-2 border border-sc-border bg-sc-btn py-3.5 font-mono text-[11px] uppercase tracking-[.18em] text-sc-accent transition-colors hover:bg-sc-btn-hi hover:text-sc-accent-hi md:hidden"
        >
          Speak with the ghost <span aria-hidden="true">☽</span>
        </button>
      ) : null}

      {/* Layout-only shell: hidden on mobile until revealed; the 396px rail cell
          on desktop. The chat's <section> carries the border, background, and the
          single header, so nothing is duplicated here. */}
      <div
        className={cn(
          revealed ? "flex" : "hidden",
          "min-h-0 flex-col",
          "md:flex md:h-full md:self-stretch",
        )}
      >
        <Interrogation owner={owner} repo={repo} />
      </div>
    </>
  );
}
