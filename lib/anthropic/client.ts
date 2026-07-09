/**
 * Lazy Anthropic client singleton (SPEC §2/§4). The client is constructed on
 * first use — never at module import — so `next build` and tests succeed with no
 * `ANTHROPIC_API_KEY` present. `readEnv` throws a descriptive, value-free error
 * when the key is missing (SPEC §9: name the variable, never its value).
 */
import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "../env";

let client: Anthropic | null = null;

/**
 * Process-wide Anthropic client. Reads `ANTHROPIC_API_KEY` lazily at first call,
 * so importing this module has no environmental side effects.
 */
export function getAnthropic(): Anthropic {
  if (client !== null) return client;
  // readEnv throws a clear "Missing required environment variable" error that
  // names the key but never leaks its value.
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  client = new Anthropic({ apiKey });
  return client;
}

/** Drop the singleton so the next `getAnthropic()` re-reads env. For tests. */
export function resetAnthropic(): void {
  client = null;
}
