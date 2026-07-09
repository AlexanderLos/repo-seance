import { describe, it, expect, vi, afterEach } from "vitest";
import { REQUIRED_ENV, missingEnv, readEnv } from "../lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("REQUIRED_ENV", () => {
  it("lists exactly the two server secrets", () => {
    expect(REQUIRED_ENV).toEqual(["GITHUB_TOKEN", "ANTHROPIC_API_KEY"]);
  });
});

describe("missingEnv", () => {
  it("is empty when both required vars are set", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_example");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-example");
    expect(missingEnv()).toEqual([]);
  });

  it("names a var that is present but blank", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_example");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(missingEnv()).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it("treats whitespace-only values as missing", () => {
    vi.stubEnv("GITHUB_TOKEN", "   ");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-example");
    expect(missingEnv()).toEqual(["GITHUB_TOKEN"]);
  });

  it("names both, in declaration order, when both are blank", () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(missingEnv()).toEqual(["GITHUB_TOKEN", "ANTHROPIC_API_KEY"]);
  });
});

describe("readEnv", () => {
  it("returns the value when present", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_secret_value");
    expect(readEnv("GITHUB_TOKEN")).toBe("ghp_secret_value");
  });

  it("throws naming the variable (and the .env.example hint) when missing", () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    expect(() => readEnv("GITHUB_TOKEN")).toThrow(/GITHUB_TOKEN/);
    expect(() => readEnv("GITHUB_TOKEN")).toThrow(/\.env\.example/);
  });

  it("does not leak the value of a sibling var in the error message", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_super_secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    let message = "";
    try {
      readEnv("ANTHROPIC_API_KEY");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).not.toContain("ghp_super_secret");
  });
});
