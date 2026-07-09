/**
 * The machine-readable evidence-block convention (SPEC §5). Every ghost answer
 * ends with a final line:
 *
 *   EVIDENCE: [{ "type": "commit", "ref": "a1b2c3d" }, ...]
 *
 * `parseEvidenceBlock` splits that trailing block off the human-facing answer
 * and returns the parsed refs. It is deliberately forgiving of code fences and
 * trailing whitespace; anything malformed or missing yields an empty ref list,
 * at which point callers substitute the canonical refusal.
 */
import { EvidenceRefSchema, type EvidenceRef } from "../autopsy/schema";

export interface ParsedEvidenceBlock {
  /** The answer text with the EVIDENCE line removed and trimmed. */
  display: string;
  /** Structurally-valid refs from the block; [] when missing or malformed. */
  refs: EvidenceRef[];
}

/** Strip a single wrapping code fence (```lang … ```) and surrounding space. */
function stripFences(input: string): string {
  let text = input.trim();
  text = text.replace(/^```[a-zA-Z0-9]*[ \t]*\r?\n?/, "");
  text = text.replace(/\r?\n?[ \t]*```[ \t]*$/, "");
  return text.trim();
}

/** Pull the `[ ... ]` JSON array substring out of a fenced/loose blob. */
function extractJsonArray(input: string): string | null {
  const text = stripFences(input);
  if (text.length === 0) return null;
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

/** Parse a JSON array into refs, keeping only structurally-valid entries. */
function parseRefs(jsonText: string): EvidenceRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const refs: EvidenceRef[] = [];
  for (const item of parsed) {
    const result = EvidenceRefSchema.safeParse(item);
    if (result.success) refs.push(result.data);
  }
  return refs;
}

/** Matches a line that (modulo leading fence/space) begins the evidence block. */
const MARKER_RE = /^[ \t]*`{0,3}[ \t]*EVIDENCE:/i;
/** Consumes the marker itself so what remains is the JSON payload. */
const MARKER_STRIP_RE = /^[ \t]*`{0,3}[ \t]*EVIDENCE:[ \t]*/i;

export function parseEvidenceBlock(text: string): ParsedEvidenceBlock {
  if (typeof text !== "string" || text.length === 0) {
    return { display: "", refs: [] };
  }

  const lines = text.replace(/\s+$/, "").split(/\r?\n/);

  // Take the LAST marker line — the real block is always at the end.
  let markerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (MARKER_RE.test(lines[i])) {
      markerIdx = i;
      break;
    }
  }

  if (markerIdx === -1) {
    return { display: stripFences(text), refs: [] };
  }

  const afterMarker = lines[markerIdx].replace(MARKER_STRIP_RE, "");
  const payload = [afterMarker, ...lines.slice(markerIdx + 1)].join("\n");
  const jsonText = extractJsonArray(payload);
  const refs = jsonText === null ? [] : parseRefs(jsonText);

  const display = stripFences(lines.slice(0, markerIdx).join("\n"));
  return { display, refs };
}
