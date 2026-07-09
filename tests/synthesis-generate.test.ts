import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { APIError } from "@anthropic-ai/sdk";
import type { Autopsy } from "../lib/autopsy/schema";
import { makeDossier, RECENT_SHA_1, FINAL_SHA } from "./fixtures";

// A single parse mock is the one control point for the LLM in every test: the
// injected client and the mocked getAnthropic() both route through it.
const { parseMock, getAnthropicMock } = vi.hoisted(() => {
  const parseMock = vi.fn();
  const getAnthropicMock = vi.fn(() => ({ messages: { parse: parseMock } }));
  return { parseMock, getAnthropicMock };
});

vi.mock("../lib/anthropic/client", () => ({
  getAnthropic: getAnthropicMock,
}));

import {
  synthesizeAutopsy,
  getOrCreateAutopsy,
  AutopsySynthesisError,
  AliveRepoError,
} from "../lib/autopsy/generate";
import { getCache, resetCache } from "../lib/cache";
import { autopsyKey, TTL_24H } from "../lib/cache/keys";

/** Mock client injected directly into synthesizeAutopsy. */
const client = { messages: { parse: parseMock } } as unknown as Anthropic;

/** A fully-cited autopsy whose every ref resolves against makeDossier(). */
const VALID_AUTOPSY: Autopsy = {
  epitaph:
    "It compiled its last on a December afternoon, then was quietly archived.",
  causes: [
    {
      label: "Archived by its owner",
      confidencePct: 95,
      evidence: [{ type: "commit", ref: FINAL_SHA.slice(0, 7) }],
    },
    {
      label: "Unanswered crash reports",
      confidencePct: 60,
      evidence: [{ type: "issue", ref: "#21234" }],
    },
  ],
  revival: [
    { step: "Fork and unarchive the repository", effort: "an afternoon" },
    { step: "Triage the open startup crash", effort: "a week" },
    { step: "Ship a maintenance release", effort: "a heroic month" },
  ],
  lastWordsGloss: "Sunset Atom — and the sun did not rise again.",
};

/** One valid ref, one bogus ref, plus a wholly-bogus cause (drops on validation). */
const MIXED_AUTOPSY: Autopsy = {
  epitaph: "A slow fade beneath a cairn of open issues.",
  causes: [
    {
      label: "Real cause with one bad citation",
      confidencePct: 80,
      evidence: [
        { type: "commit", ref: RECENT_SHA_1.slice(0, 7) }, // valid
        { type: "issue", ref: "#999999" }, // invalid -> stripped
      ],
    },
    {
      label: "Phantom cause",
      confidencePct: 40,
      evidence: [{ type: "branch", ref: "nonexistent-branch" }], // invalid -> dropped
    },
  ],
  revival: [
    { step: "one", effort: "a" },
    { step: "two", effort: "b" },
    { step: "three", effort: "c" },
  ],
  lastWordsGloss: "the gloss",
};

/** Every citation is invented — no cause survives validation. */
const ALL_INVALID_AUTOPSY: Autopsy = {
  epitaph: "e",
  causes: [
    {
      label: "phantom one",
      confidencePct: 50,
      evidence: [{ type: "issue", ref: "#999999" }],
    },
    {
      label: "phantom two",
      confidencePct: 30,
      evidence: [{ type: "branch", ref: "ghost" }],
    },
  ],
  revival: [
    { step: "one", effort: "a" },
    { step: "two", effort: "b" },
    { step: "three", effort: "c" },
  ],
  lastWordsGloss: "g",
};

/** Shape the runParse call reads: stop_reason + parsed_output. */
function ok(autopsy: Autopsy) {
  return { stop_reason: "end_turn", parsed_output: autopsy };
}
function refusal() {
  return { stop_reason: "refusal", parsed_output: null };
}
function noJson() {
  return { stop_reason: "end_turn", parsed_output: null };
}

/** Typed view of the prompt strings passed to parse, avoiding `any` access. */
function promptOf(callIndex: number): string {
  const calls = parseMock.mock.calls as unknown as Array<
    [{ messages: Array<{ content: string }> }]
  >;
  return calls[callIndex][0].messages[0].content;
}

const savedEnv = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
};

// Suppress the validateEvidence console.warn noise, restored per test so the
// hoisted parse/getAnthropic mocks keep their implementations intact.
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Force the in-memory cache; tests never touch a live Redis (nor a live LLM).
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetCache();
  parseMock.mockReset();
  getAnthropicMock.mockClear();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

afterAll(() => {
  if (savedEnv.url !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedEnv.url;
  if (savedEnv.token !== undefined)
    process.env.UPSTASH_REDIS_REST_TOKEN = savedEnv.token;
});

describe("synthesizeAutopsy — happy path", () => {
  it("returns the parsed autopsy from a single grounded call", async () => {
    parseMock.mockResolvedValueOnce(ok(VALID_AUTOPSY));

    const result = await synthesizeAutopsy(makeDossier(), client);

    expect(result).toEqual(VALID_AUTOPSY);
    expect(parseMock).toHaveBeenCalledTimes(1);
    // The grounded inventory really reached the model.
    expect(promptOf(0)).toContain(RECENT_SHA_1);
  });
});

describe("synthesizeAutopsy — reject-and-retry once (SPEC §4)", () => {
  it("retries with a corrective note when the first output has no JSON", async () => {
    parseMock.mockResolvedValueOnce(noJson()).mockResolvedValueOnce(ok(VALID_AUTOPSY));

    const result = await synthesizeAutopsy(makeDossier(), client);

    expect(result).toEqual(VALID_AUTOPSY);
    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(promptOf(1)).toContain("Your previous output failed validation");
  });

  it("retries after a thrown schema-parse error, then succeeds", async () => {
    parseMock
      .mockRejectedValueOnce(new Error("Failed to parse structured output"))
      .mockResolvedValueOnce(ok(VALID_AUTOPSY));

    const result = await synthesizeAutopsy(makeDossier(), client);

    expect(result).toEqual(VALID_AUTOPSY);
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("throws AutopsySynthesisError after a refusal then a second failure", async () => {
    parseMock.mockResolvedValueOnce(refusal()).mockResolvedValueOnce(noJson());

    await expect(synthesizeAutopsy(makeDossier(), client)).rejects.toBeInstanceOf(
      AutopsySynthesisError,
    );
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a transport APIError without retrying (not a parse failure)", async () => {
    parseMock.mockRejectedValueOnce(
      new APIError(500, undefined, "upstream is down", undefined),
    );

    await expect(
      synthesizeAutopsy(makeDossier(), client),
    ).rejects.toBeInstanceOf(APIError);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });
});

describe("getOrCreateAutopsy — evidence validation (SPEC §4 hard rule)", () => {
  it("strips invalid refs and drops evidence-less causes in code", async () => {
    parseMock.mockResolvedValueOnce(ok(MIXED_AUTOPSY));

    const result = await getOrCreateAutopsy(makeDossier());

    expect(result.causes).toHaveLength(1);
    expect(result.causes[0].label).toBe("Real cause with one bad citation");
    expect(result.causes[0].evidence).toEqual([
      { type: "commit", ref: RECENT_SHA_1.slice(0, 7) },
    ]);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("caches the validated (stripped) autopsy — repeat visits cost no LLM call", async () => {
    parseMock.mockResolvedValueOnce(ok(MIXED_AUTOPSY));

    const first = await getOrCreateAutopsy(makeDossier());
    const second = await getOrCreateAutopsy(makeDossier());

    expect(second).toEqual(first);
    expect(second.causes).toHaveLength(1);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("re-synthesizes once, then errors, when no cause survives validation", async () => {
    parseMock.mockResolvedValue(ok(ALL_INVALID_AUTOPSY));

    await expect(getOrCreateAutopsy(makeDossier())).rejects.toBeInstanceOf(
      AutopsySynthesisError,
    );
    expect(parseMock).toHaveBeenCalledTimes(2);
  });
});

describe("getOrCreateAutopsy — cache", () => {
  it("returns a cached autopsy without touching the LLM", async () => {
    await getCache().set(autopsyKey("atom", "atom"), VALID_AUTOPSY, TTL_24H);

    const result = await getOrCreateAutopsy(makeDossier());

    expect(result).toEqual(VALID_AUTOPSY);
    expect(parseMock).not.toHaveBeenCalled();
    expect(getAnthropicMock).not.toHaveBeenCalled();
  });

  it("keys case-insensitively so Atom/Atom hits the atom/atom entry", async () => {
    await getCache().set(autopsyKey("atom", "atom"), VALID_AUTOPSY, TTL_24H);

    const dossier = makeDossier();
    const mixedCase = makeDossier({
      repo: { ...dossier.repo, owner: "Atom", name: "Atom" },
    });
    const result = await getOrCreateAutopsy(mixedCase);

    expect(result).toEqual(VALID_AUTOPSY);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe("getOrCreateAutopsy — liveness honesty (SPEC §3)", () => {
  it("refuses to autopsy a living repository and never calls the LLM", async () => {
    const alive = makeDossier({
      death: {
        status: "alive",
        daysSincePush: 3,
        flatlineMonth: null,
        reason: "Last commit 3 days ago. This one still breathes.",
      },
    });

    await expect(getOrCreateAutopsy(alive)).rejects.toBeInstanceOf(AliveRepoError);
    expect(parseMock).not.toHaveBeenCalled();
    expect(getAnthropicMock).not.toHaveBeenCalled();
  });
});
