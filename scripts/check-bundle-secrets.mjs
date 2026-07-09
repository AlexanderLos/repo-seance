#!/usr/bin/env node
/*
 * scripts/check-bundle-secrets.mjs — build-output secret gate (SPEC §9).
 *
 * After `next build`, prove that no server-only secret can reach the client.
 * It walks the build output:
 *
 *   • .next/static  (client bundles) — fails on secret env *names* OR secret
 *     *value* patterns. Nothing secret legitimately belongs in client code.
 *   • .next/server  (server bundles) — fails on secret *value* patterns only.
 *     Server code may legitimately reference `process.env.ANTHROPIC_API_KEY`
 *     etc. by name, so names are not flagged there.
 *
 * It never reads .env files, and never prints matched content — only the file
 * path and the name of the pattern that matched — so a real leaked secret is
 * never echoed into CI logs.
 *
 * Plain Node, zero dependencies. Exit 1 on any finding (or when the build
 * output is missing); exit 0 when the bundle is clean.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, ".next");
const STATIC_DIR = join(NEXT_DIR, "static");
const SERVER_DIR = join(NEXT_DIR, "server");

// Only text-like outputs can carry a leaked string; fonts/images are skipped.
const TEXT_EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".map",
  ".html",
  ".css",
  ".txt",
  ".svg",
]);
const SKIP_DIRS = new Set(["cache"]); // build cache is not shipped

// Secret env var *names* — must never be inlined into client code.
const NAME_PATTERNS = [
  { name: "ANTHROPIC_API_KEY", re: /ANTHROPIC_API_KEY/ },
  { name: "GITHUB_TOKEN", re: /GITHUB_TOKEN/ },
  { name: "UPSTASH_REDIS_REST_TOKEN", re: /UPSTASH_REDIS_REST_TOKEN/ },
];

// Secret *value* shapes — must never appear anywhere in shipped output.
const VALUE_PATTERNS = [
  { name: "anthropic-key (sk-ant-…)", re: /sk-ant-[a-zA-Z0-9_-]{8,}/ },
  { name: "github-pat (github_pat_…)", re: /github_pat_[a-zA-Z0-9_]{8,}/ },
];

function collect(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) stack.push(full);
      } else if (ent.isFile() && TEXT_EXT.has(extname(ent.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

function scan(dir, patterns) {
  const findings = [];
  for (const file of collect(dir)) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const p of patterns) {
      // Note: `test` on a non-global regex is stateless — safe to reuse.
      if (p.re.test(content)) {
        findings.push({ file: relative(ROOT, file), pattern: p.name });
      }
    }
  }
  return findings;
}

if (!existsSync(NEXT_DIR)) {
  console.error("✗ check:secrets — .next/ not found. Run `pnpm build` first.");
  process.exit(1);
}

const haveStatic = existsSync(STATIC_DIR);
const haveServer = existsSync(SERVER_DIR);

if (!haveStatic && !haveServer) {
  console.error(
    "✗ check:secrets — no .next/static or .next/server output found. Run `pnpm build` first.",
  );
  process.exit(1);
}

const findings = [];
if (haveStatic) {
  findings.push(...scan(STATIC_DIR, [...NAME_PATTERNS, ...VALUE_PATTERNS]));
}
if (haveServer) {
  findings.push(...scan(SERVER_DIR, VALUE_PATTERNS));
}

if (findings.length > 0) {
  console.error(
    "\n✗ check:secrets — potential secret leak in build output (SPEC §9):\n",
  );
  for (const f of findings) {
    console.error(`  ${f.file}  →  matched pattern: ${f.pattern}`);
  }
  console.error(
    `\n${findings.length} match${findings.length === 1 ? "" : "es"}. (matched content withheld by design)`,
  );
  process.exit(1);
}

const scanned = [];
if (haveStatic) scanned.push(".next/static (names + value patterns)");
if (haveServer) scanned.push(".next/server (value patterns)");
console.log(
  `✓ check:secrets — no secret names or token patterns in the bundle. Scanned ${scanned.join(", ")}.`,
);
process.exit(0);
