"use client";

/**
 * The interrogation container (SPEC §6). It owns positioning and chrome only —
 * the séance itself is teammate D's `<Interrogation>` (components/chat), mounted
 * once inside. Desktop: the fixed 396px right rail. Mobile: a trigger that opens
 * a full-height sheet (Escape / backdrop / close button dismiss it), so the chat
 * lands last in the single-column case file per the responsive order.
 */
import { useEffect, useRef, useState } from "react";
import { Interrogation } from "@/components/chat/interrogation";
import { cn } from "../util/cn";

const SUBTITLE =
  "Every answer cites its evidence. No séance theatrics without receipts.";

export function InterrogationPanel({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {/* Mobile trigger — sits at the end of the single-column case file. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 border border-sc-border bg-sc-btn py-3.5 font-mono text-[11px] uppercase tracking-[.18em] text-sc-accent transition-colors hover:bg-sc-btn-hi hover:text-sc-accent-hi md:hidden"
      >
        Speak with the ghost <span aria-hidden="true">☽</span>
      </button>

      {/* Backdrop — mobile only, while the sheet is open. */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-sc-bg/70 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* The panel: mobile sheet when open, static right rail on desktop. */}
      <aside
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Interrogation"
        className={cn(
          open ? "fixed inset-0 z-50 flex" : "hidden",
          "flex-col border-sc-border bg-sc-panel",
          "md:static md:z-auto md:flex md:h-full md:self-stretch md:border",
          "min-h-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sc-hair px-5 py-4">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
              Interrogation
            </h2>
            <p className="mt-1.5 text-[11px] text-sc-faint">{SUBTITLE}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close interrogation"
            className="flex-shrink-0 border border-sc-border px-2.5 py-1 font-mono text-sm text-sc-muted transition-colors hover:border-sc-border-hi hover:text-sc-body md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <Interrogation owner={owner} repo={repo} />
        </div>
      </aside>
    </>
  );
}
