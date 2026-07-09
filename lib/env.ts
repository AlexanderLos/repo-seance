/**
 * Environment-variable contract (SPEC §2/§9). All checks are lazy/runtime —
 * nothing here reads env at module import, so `next build` succeeds with no env
 * present. Errors name the missing variable but NEVER its value.
 */

/** The variables the app cannot run without. */
export const REQUIRED_ENV = ["GITHUB_TOKEN", "ANTHROPIC_API_KEY"] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV)[number];

/** True when a variable is unset or blank (whitespace-only counts as missing). */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** Names of the required variables that are missing, in declaration order. */
export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => isBlank(process.env[name]));
}

/**
 * Read a required variable or throw a descriptive error that names the variable
 * (never its value). Use for values needed at request time.
 */
export function readEnv(name: string): string {
  const value = process.env[name];
  if (isBlank(value)) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in .env.local (see .env.example).`,
    );
  }
  return value as string;
}
