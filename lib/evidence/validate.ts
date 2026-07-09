/**
 * The hard rule, enforced in code and not in the prompt (SPEC §4/§5).
 *
 * `resolveEvidence` turns a single `EvidenceRef` into a real GitHub URL + label
 * ONLY if the ref genuinely exists in the Dossier; otherwise it returns null.
 * `validateEvidence` walks a set of causes, strips refs that don't resolve, and
 * drops any cause left with no surviving evidence. `validateRefs` is the flat
 * equivalent for the ghost chat's evidence block. The UI must never render a
 * chip that didn't come back from here.
 */
import type { Dossier } from "../dossier/types";
import type { Cause, EvidenceRef } from "../autopsy/schema";

/** A resolved, renderable citation. */
export interface ResolvedEvidence {
  url: string;
  label: string;
}

/** Repo URL with any trailing slash removed, e.g. `https://github.com/atom/atom`. */
function repoBaseUrl(dossier: Dossier): string {
  return dossier.repo.htmlUrl.replace(/\/+$/, "");
}

/** Percent-encode each path segment while preserving `/` separators. */
function encodePathSegments(p: string): string {
  return p
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Resolve one evidence ref against the Dossier. Returns a `{ url, label }` pair
 * for a ref that exists, or null for one that does not. Purely a lookup — no
 * network, no LLM.
 */
export function resolveEvidence(
  dossier: Dossier,
  ref: EvidenceRef,
): ResolvedEvidence | null {
  const base = repoBaseUrl(dossier);

  switch (ref.type) {
    case "commit": {
      // A ref is a sha prefix; require ≥7 chars, matched against the citable set.
      const prefix = ref.ref.trim().toLowerCase();
      if (prefix.length < 7) return null;
      const shas = dossier.commits.recent.map((commit) => commit.sha);
      if (dossier.commits.finalCommit) {
        shas.push(dossier.commits.finalCommit.sha);
      }
      const match = shas.find((sha) => sha.toLowerCase().startsWith(prefix));
      if (match === undefined) return null;
      return { url: `${base}/commit/${match}`, label: match.slice(0, 7) };
    }

    case "issue": {
      // Accept `#12` or `12`; the number must exist in the fetched issue set.
      const parsed = ref.ref.trim().match(/^#?(\d+)$/);
      if (parsed === null) return null;
      const num = Number(parsed[1]);
      const exists = dossier.issues.items.some((issue) => issue.number === num);
      if (!exists) return null;
      return { url: `${base}/issues/${num}`, label: `#${num}` };
    }

    case "branch": {
      const name = ref.ref.trim();
      const exists = dossier.branches.items.some(
        (branch) => branch.name === name,
      );
      if (!exists) return null;
      return { url: `${base}/tree/${encodePathSegments(name)}`, label: name };
    }

    case "file": {
      // File refs are only citable when they name a scanned TODO/FIXME path.
      const path = ref.ref.trim();
      const exists = dossier.todos.items.some((todo) => todo.path === path);
      if (!exists) return null;
      const branch = encodePathSegments(dossier.repo.defaultBranch);
      return {
        url: `${base}/blob/${branch}/${encodePathSegments(path)}`,
        label: path,
      };
    }

    case "readme": {
      // Only citable when we actually captured README text.
      if (dossier.readme.excerpt === null) return null;
      return { url: `${base}#readme`, label: "README" };
    }

    default: {
      // Exhaustiveness guard: adding an EvidenceRef type without a case here
      // becomes a compile error rather than a silent skip.
      const _exhaustive: never = ref.type;
      return _exhaustive;
    }
  }
}

/** Outcome of validating a set of causes (SPEC §4). */
export interface ValidateEvidenceResult {
  /** Causes with only-valid evidence; causes with zero valid evidence removed. */
  causes: Cause[];
  /** Individual refs that failed to resolve and were stripped. */
  strippedRefs: EvidenceRef[];
  /** Causes dropped entirely because nothing they cited resolved. */
  droppedCauses: Cause[];
}

/**
 * Validate autopsy causes. Invalid refs are stripped; a cause left with no
 * surviving evidence is dropped. Drops are logged server-side via console.warn.
 */
export function validateEvidence(
  dossier: Dossier,
  causes: Cause[],
): ValidateEvidenceResult {
  const validCauses: Cause[] = [];
  const strippedRefs: EvidenceRef[] = [];
  const droppedCauses: Cause[] = [];

  for (const cause of causes) {
    const survivingEvidence: EvidenceRef[] = [];
    for (const ref of cause.evidence) {
      if (resolveEvidence(dossier, ref) !== null) {
        survivingEvidence.push(ref);
      } else {
        strippedRefs.push(ref);
      }
    }
    if (survivingEvidence.length === 0) {
      droppedCauses.push(cause);
    } else {
      validCauses.push({ ...cause, evidence: survivingEvidence });
    }
  }

  if (strippedRefs.length > 0 || droppedCauses.length > 0) {
    console.warn(
      `[evidence] stripped ${strippedRefs.length} invalid ref(s); dropped ${droppedCauses.length} cause(s) with no surviving evidence`,
    );
  }

  return { causes: validCauses, strippedRefs, droppedCauses };
}

/** Outcome of validating a flat list of refs (the ghost's evidence block). */
export interface ValidateRefsResult {
  /** The refs that resolved, in original order. */
  refs: EvidenceRef[];
  /** Their resolved `{ url, label }` pairs, aligned with `refs`. */
  resolved: ResolvedEvidence[];
  /** Refs that failed to resolve and were stripped. */
  strippedRefs: EvidenceRef[];
}

/**
 * Validate the flat evidence refs from a ghost answer. Callers substitute the
 * canonical refusal when `resolved` comes back empty (SPEC §5). Same resolver as
 * `validateEvidence`, so autopsy and chat cite identically.
 */
export function validateRefs(
  dossier: Dossier,
  refs: EvidenceRef[],
): ValidateRefsResult {
  const kept: EvidenceRef[] = [];
  const resolved: ResolvedEvidence[] = [];
  const strippedRefs: EvidenceRef[] = [];

  for (const ref of refs) {
    const hit = resolveEvidence(dossier, ref);
    if (hit !== null) {
      kept.push(ref);
      resolved.push(hit);
    } else {
      strippedRefs.push(ref);
    }
  }

  if (strippedRefs.length > 0) {
    console.warn(
      `[evidence] stripped ${strippedRefs.length} invalid ref(s) from a ghost answer`,
    );
  }

  return { refs: kept, resolved, strippedRefs };
}
