"use client";

/**
 * Unfinished business (DESIGN-NOTES §5.4a): a real tabbed panel over the
 * Dossier's branches, issues, and TODO scan. Tabs are keyboard-reachable with
 * `aria-selected`; every ref is a real GitHub link. The TODO tab shows an honest
 * in-voice empty state when the code search degraded (SPEC §3) — never fabricated
 * entries. All GitHub-sourced text is rendered through React (escaped, SPEC §9).
 */
import { useId, useState } from "react";
import type { Dossier } from "@/lib/dossier/types";
import { shortAge } from "../util/format";
import { cn } from "../util/cn";

type TabKey = "branches" | "issues" | "todos";

function Row({
  refNode,
  title,
  meta,
}: {
  refNode: React.ReactNode;
  title: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="flex items-baseline gap-3.5 border-t border-sc-row py-[11px]">
      <span className="w-[68px] flex-shrink-0 truncate font-mono text-[11px] text-sc-dim">
        {refNode}
      </span>
      <span className="min-w-0 flex-1 break-words text-[12.5px] text-sc-body">
        {title}
      </span>
      {meta ? (
        <span className="flex-shrink-0 font-mono text-[10.5px] text-sc-muted">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

export function UnfinishedBusiness({ dossier }: { dossier: Dossier }) {
  const base = dossier.repo.htmlUrl.replace(/\/+$/, "");
  const now = dossier.fetchedAt;
  const branchLink = (name: string) =>
    `${base}/tree/${name.split("/").map(encodeURIComponent).join("/")}`;
  const fileLink = (path: string) =>
    `${base}/blob/${encodeURIComponent(dossier.repo.defaultBranch)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

  const tabs: { key: TabKey; label: string; count: number | null }[] = [
    { key: "branches", label: "Branches", count: dossier.branches.items.length },
    { key: "issues", label: "Issues", count: dossier.issues.stats.openCount },
    {
      key: "todos",
      label: "TODOs",
      count: dossier.todos.degraded ? null : dossier.todos.items.length,
    },
  ];

  const [active, setActive] = useState<TabKey>("branches");
  const baseId = useId();

  return (
    <section className="border border-sc-border bg-sc-panel px-6 py-[22px]">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
          Unfinished business
        </h2>
        <div role="tablist" aria-label="Unfinished business" className="flex gap-0.5">
          {tabs.map((tab) => {
            const selected = active === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                id={`${baseId}-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                onClick={() => setActive(tab.key)}
                className={cn(
                  "cursor-pointer border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[.1em] transition-colors",
                  selected
                    ? "border-sc-border-hi bg-sc-btn text-sc-accent-hi"
                    : "border-sc-hair bg-transparent text-sc-muted hover:text-sc-body",
                )}
              >
                {tab.label} · {tab.count ?? "—"}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="flex flex-col"
      >
        {active === "branches" &&
          (dossier.branches.items.length === 0 ? (
            <p className="py-4 font-serif text-base italic text-sc-quote">
              No stray branches — the tree was left tidy.
            </p>
          ) : (
            dossier.branches.items.map((b) => (
              <Row
                key={b.name}
                refNode="branch"
                title={
                  <a
                    href={branchLink(b.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-sc-accent"
                  >
                    {b.name}
                  </a>
                }
                meta={[
                  b.behindBy !== null ? `${b.behindBy} behind` : null,
                  shortAge(b.lastCommitDate, now),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          ))}

        {active === "issues" &&
          (dossier.issues.items.length === 0 ? (
            <p className="py-4 font-serif text-base italic text-sc-quote">
              No issues on the books — nothing was ever filed.
            </p>
          ) : (
            dossier.issues.items.map((issue) => (
              <Row
                key={issue.number}
                refNode={
                  <a
                    href={`${base}/issues/${issue.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-sc-accent"
                  >
                    #{issue.number}
                  </a>
                }
                title={issue.title}
                meta={[
                  issue.state,
                  issue.labels[0] ?? null,
                  shortAge(issue.createdAt, now),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          ))}

        {active === "todos" &&
          (dossier.todos.degraded ? (
            <p className="py-4 font-serif text-base italic text-sc-quote">
              The code search was sealed — no TODOs could be exhumed this time.
            </p>
          ) : dossier.todos.items.length === 0 ? (
            <p className="py-4 font-serif text-base italic text-sc-quote">
              Not a single TODO left behind. Suspiciously clean.
            </p>
          ) : (
            dossier.todos.items.map((todo) => (
              <Row
                key={todo.path}
                refNode={
                  <a
                    href={fileLink(todo.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-sc-accent"
                  >
                    {todo.path.split("/").pop() ?? todo.path}
                  </a>
                }
                title={todo.snippet}
              />
            ))
          ))}
      </div>
    </section>
  );
}
