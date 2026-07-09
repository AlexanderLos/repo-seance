/**
 * The Dossier — the single typed structure that holds every fact fetched from
 * GitHub for a repository. It is the ONLY source of truth the LLM ever sees
 * (SPEC §3). Every schema here is paired with its inferred TypeScript type so
 * downstream code can both validate at runtime and type against it at compile
 * time.
 */
import { z } from "zod";

/** ISO-8601 datetime, e.g. GitHub's `2022-12-15T12:00:00Z`. Offsets allowed. */
const isoDateTime = z.iso.datetime({ offset: true });

/** A calendar month bucket key, `YYYY-MM`. Lexical order === chronological. */
const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "expected a YYYY-MM month string");

/** Repository metadata (SPEC §3). */
export const RepoMetaSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  description: z.string().nullable(),
  htmlUrl: z.url(),
  createdAt: isoDateTime,
  pushedAt: isoDateTime,
  archived: z.boolean(),
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
  defaultBranch: z.string().min(1),
  license: z.string().nullable(),
});
export type RepoMeta = z.infer<typeof RepoMetaSchema>;

/** A single commit, captured fully enough to cite it. */
export const CommitInfoSchema = z.object({
  sha: z.string().min(1),
  message: z.string(),
  date: isoDateTime,
  authorName: z.string(),
  authorLogin: z.string().nullable(),
});
export type CommitInfo = z.infer<typeof CommitInfoSchema>;

/** Commit count for one month, feeding the decline chart. */
export const MonthlyBucketSchema = z.object({
  month: monthString,
  count: z.number().int().min(0),
});
export type MonthlyBucket = z.infer<typeof MonthlyBucketSchema>;

/** A branch, with ahead/behind vs. the default branch where cheaply known. */
export const BranchInfoSchema = z.object({
  name: z.string().min(1),
  lastCommitDate: isoDateTime,
  aheadBy: z.number().int().min(0).nullable(),
  behindBy: z.number().int().min(0).nullable(),
});
export type BranchInfo = z.infer<typeof BranchInfoSchema>;

/** A GitHub issue (state=all). */
export const IssueInfoSchema = z.object({
  number: z.number().int().min(1),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  createdAt: isoDateTime,
  closedAt: isoDateTime.nullable(),
  comments: z.number().int().min(0),
  labels: z.array(z.string()),
});
export type IssueInfo = z.infer<typeof IssueInfoSchema>;

/** Derived issue statistics (SPEC §3). */
export const IssueStatsSchema = z.object({
  openCount: z.number().int().min(0),
  totalFetched: z.number().int().min(0),
  /** Median may be fractional; null when nothing answerable was found. */
  medianDaysToFirstResponse: z.number().min(0).nullable(),
  openOverOneYearNoReply: z.number().int().min(0),
});
export type IssueStats = z.infer<typeof IssueStatsSchema>;

/** A single TODO/FIXME hit from the code search scan. */
export const TodoItemSchema = z.object({
  path: z.string().min(1),
  snippet: z.string(),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

/** Deterministic death verdict (SPEC §3) — never produced by the LLM. */
export const DeathSchema = z.object({
  status: z.enum(["dead", "dying", "alive"]),
  daysSincePush: z.number().int().min(0),
  flatlineMonth: monthString.nullable(),
  reason: z.string().min(1),
});
export type Death = z.infer<typeof DeathSchema>;

/** Commit section of the Dossier. `recent` is the citable set (≤30, newest first). */
export const CommitsSectionSchema = z.object({
  totalCount: z.number().int().min(0),
  fetchedCount: z.number().int().min(0),
  capped: z.boolean(),
  monthly: z.array(MonthlyBucketSchema),
  recent: z.array(CommitInfoSchema).max(30),
  finalCommit: CommitInfoSchema.nullable(),
});
export type CommitsSection = z.infer<typeof CommitsSectionSchema>;

/** Branch section of the Dossier. */
export const BranchesSectionSchema = z.object({
  items: z.array(BranchInfoSchema),
  capped: z.boolean(),
});
export type BranchesSection = z.infer<typeof BranchesSectionSchema>;

/** Issue section of the Dossier. */
export const IssuesSectionSchema = z.object({
  items: z.array(IssueInfoSchema),
  stats: IssueStatsSchema,
  capped: z.boolean(),
});
export type IssuesSection = z.infer<typeof IssuesSectionSchema>;

/** README section of the Dossier. `excerpt` null when no README was found. */
export const ReadmeSectionSchema = z.object({
  excerpt: z.string().nullable(),
  truncated: z.boolean(),
});
export type ReadmeSection = z.infer<typeof ReadmeSectionSchema>;

/** TODO section of the Dossier. `degraded` true when the search API was skipped. */
export const TodosSectionSchema = z.object({
  items: z.array(TodoItemSchema),
  degraded: z.boolean(),
});
export type TodosSection = z.infer<typeof TodosSectionSchema>;

/** The complete Dossier — the whole contract in one object (SPEC §3). */
export const DossierSchema = z.object({
  version: z.literal("v1"),
  repo: RepoMetaSchema,
  commits: CommitsSectionSchema,
  branches: BranchesSectionSchema,
  issues: IssuesSectionSchema,
  readme: ReadmeSectionSchema,
  todos: TodosSectionSchema,
  death: DeathSchema,
  fetchedAt: isoDateTime,
});
export type Dossier = z.infer<typeof DossierSchema>;
