"use client";

/**
 * The Exhume control — a segmented `git://` field that parses whatever is pasted
 * (a bare `owner/repo` or a full GitHub URL) and navigates to `/{owner}/{repo}`.
 * Two sizes: `sm` for the header, `lg` for the landing hero. Invalid input gets
 * an in-voice hint rather than a dead submit. Keyboard: Enter submits (it's a
 * real form); the button carries an aria-label (SPEC §6 a11y).
 */
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { parseRepoInput, repoPath } from "./util/slug";
import { cn } from "./util/cn";

export function ExhumeBar({
  size = "sm",
  initialValue = "",
  autoFocus = false,
}: {
  size?: "sm" | "lg";
  initialValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const lg = size === "lg";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const slug = parseRepoInput(value);
    if (slug === null) {
      setError("That doesn't read like a grave. Try owner/repo.");
      return;
    }
    setError(null);
    router.push(repoPath(slug));
  }

  return (
    <form onSubmit={submit} className="w-full" noValidate>
      <div
        className={cn(
          "flex items-stretch border bg-sc-input",
          error ? "border-sc-danger-line" : "border-sc-border",
          lg ? "h-14" : "h-[38px]",
        )}
      >
        <span
          className={cn(
            "flex flex-shrink-0 items-center border-r border-sc-hair px-3 font-mono text-sc-muted",
            lg ? "text-base" : "text-[13px]",
          )}
        >
          git://
        </span>
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="owner/repo"
          aria-label="GitHub repository to exhume"
          aria-invalid={error !== null}
          aria-describedby={error ? hintId : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3 font-mono text-sc-body outline-none placeholder:text-sc-faint",
            lg ? "text-base" : "text-[13px]",
          )}
        />
        <button
          type="submit"
          aria-label="Exhume this repository"
          className={cn(
            "flex-shrink-0 cursor-pointer border-l border-sc-border bg-sc-btn font-mono uppercase tracking-[.18em] text-sc-accent transition-colors hover:bg-sc-btn-hi hover:text-sc-accent-hi",
            lg ? "px-7 text-xs" : "px-[18px] text-[11px]",
          )}
        >
          Exhume
        </button>
      </div>
      {error ? (
        <p
          id={hintId}
          role="alert"
          className={cn(
            "mt-2 font-mono text-sc-danger-text",
            lg ? "text-sm" : "text-[11px]",
          )}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
