/**
 * Filesystem + schema plumbing for the eval suite. All paths are resolved from
 * the process working directory — `pnpm evals` and `pnpm test` both run from the
 * repository root — and every loaded artifact is validated with the frozen zod
 * schemas so a malformed fixture or recording fails loudly, never silently.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { DossierSchema, type Dossier } from "../lib/dossier/types";
import { AutopsySchema, type Autopsy } from "../lib/autopsy/schema";

/**
 * The suite's fixed reference clock. Fixtures were recorded against this instant
 * (their `death` blocks were computed by `determineDeath` at this time), so the
 * liveness checks re-run `determineDeath` with the very same clock.
 */
export const EVAL_NOW = new Date("2026-07-08T00:00:00.000Z");

/** Every fixture id, in a stable order. */
export const FIXTURE_IDS = [
  "archived-framework",
  "silent-cli",
  "dying-lib",
  "alive-app",
  "haunted-readme",
] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

/** Dead fixtures get a recorded autopsy (SPEC §4). */
export const DEAD_FIXTURE_IDS: readonly FixtureId[] = [
  "archived-framework",
  "silent-cli",
  "haunted-readme",
];

/** The one alive fixture — it must never yield a death certificate (SPEC §3). */
export const ALIVE_FIXTURE_ID: FixtureId = "alive-app";

const EVALS_DIR = resolve(process.cwd(), "evals");
export const FIXTURES_DIR = resolve(EVALS_DIR, "fixtures");
export const RECORDED_DIR = resolve(EVALS_DIR, "recorded");
export const CHAT_DIR = resolve(RECORDED_DIR, "chat");

/** Absolute path of a fixture's committed Dossier snapshot. */
export function fixturePath(id: FixtureId): string {
  return resolve(FIXTURES_DIR, `${id}.dossier.json`);
}

/** Absolute path of a fixture's recorded autopsy (RECORD mode writes it). */
export function autopsyRecordingPath(id: FixtureId): string {
  return resolve(RECORDED_DIR, `${id}.autopsy.json`);
}

/** Absolute path of a chat case's recorded answer (RECORD mode writes it). */
export function chatRecordingPath(caseId: string): string {
  return resolve(CHAT_DIR, `${caseId}.json`);
}

function readJson(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as unknown;
}

/** Load and validate a fixture Dossier (throws on schema violation). */
export function loadFixture(id: FixtureId): Dossier {
  return DossierSchema.parse(readJson(fixturePath(id)));
}

/** Load every fixture, keyed by id, each validated against DossierSchema. */
export function loadAllFixtures(): Map<FixtureId, Dossier> {
  const map = new Map<FixtureId, Dossier>();
  for (const id of FIXTURE_IDS) {
    map.set(id, loadFixture(id));
  }
  return map;
}

/** Load and validate a recorded autopsy (post-§4-pipeline; throws if invalid). */
export function loadRecordedAutopsy(id: FixtureId): Autopsy {
  return AutopsySchema.parse(readJson(autopsyRecordingPath(id)));
}

/** The shape RECORD mode writes for each chat case. */
export const ChatRecordingSchema = z.object({
  question: z.string().min(1),
  rawText: z.string(),
});
export type ChatRecording = z.infer<typeof ChatRecordingSchema>;

/** Load and validate a recorded chat answer (throws if malformed). */
export function loadRecordedChat(caseId: string): ChatRecording {
  return ChatRecordingSchema.parse(readJson(chatRecordingPath(caseId)));
}

/** True when a recording file is present on disk. */
export function recordingExists(path: string): boolean {
  return existsSync(path);
}
