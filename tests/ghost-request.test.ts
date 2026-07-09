import { describe, it, expect } from "vitest";
import {
  parseChatBody,
  normalizeHistory,
  MAX_CONTENT_CHARS,
  MAX_TURNS,
  type ChatMessage,
} from "../app/api/chat/request";

const user = (content: string): ChatMessage => ({ role: "user", content });
const assistant = (content: string): ChatMessage => ({
  role: "assistant",
  content,
});

describe("parseChatBody — accepts well-formed requests", () => {
  it("returns owner, repo, and the normalised messages", () => {
    const result = parseChatBody({
      owner: "atom",
      repo: "atom",
      messages: [{ role: "user", content: "Why did you stop?" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owner).toBe("atom");
      expect(result.value.repo).toBe("atom");
      expect(result.value.messages).toHaveLength(1);
    }
  });
});

describe("parseChatBody — rejects junk", () => {
  it.each([
    ["null", null],
    ["a string", "not an object"],
    ["an empty object", {}],
    ["missing messages", { owner: "atom", repo: "atom" }],
    [
      "empty message list",
      { owner: "atom", repo: "atom", messages: [] },
    ],
    [
      "an unknown role",
      {
        owner: "atom",
        repo: "atom",
        messages: [{ role: "system", content: "hi" }],
      },
    ],
    [
      "empty content",
      { owner: "atom", repo: "atom", messages: [{ role: "user", content: "" }] },
    ],
    [
      "over-long content",
      {
        owner: "atom",
        repo: "atom",
        messages: [{ role: "user", content: "x".repeat(MAX_CONTENT_CHARS + 1) }],
      },
    ],
    [
      "a path-traversal owner",
      {
        owner: "../../etc",
        repo: "atom",
        messages: [{ role: "user", content: "hi" }],
      },
    ],
    [
      "a repo with spaces",
      {
        owner: "atom",
        repo: "a b",
        messages: [{ role: "user", content: "hi" }],
      },
    ],
  ])("rejects %s", (_label, body) => {
    expect(parseChatBody(body).ok).toBe(false);
  });

  it("rejects a history that normalises to empty (all assistant)", () => {
    const result = parseChatBody({
      owner: "atom",
      repo: "atom",
      messages: [{ role: "assistant", content: "orphan reply" }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("normalizeHistory — caps and re-anchors the conversation", () => {
  it("keeps only the most recent MAX_TURNS messages", () => {
    const many: ChatMessage[] = Array.from({ length: MAX_TURNS + 10 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : assistant(`a${i}`),
    );
    const capped = normalizeHistory(many);
    expect(capped.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(capped[0].role).toBe("user");
    expect(capped[capped.length - 1]).toEqual(many[many.length - 1]);
  });

  it("drops leading assistant turns so it starts with the user", () => {
    const hist = [assistant("a"), assistant("b"), user("c")];
    const normalized = normalizeHistory(hist);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual(user("c"));
  });
});
