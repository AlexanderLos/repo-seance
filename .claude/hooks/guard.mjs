#!/usr/bin/env node
/**
 * PreToolUse guard for the Repo Séance autonomous run (Phase 0 governance).
 *
 * Fail-closed: if this script cannot evaluate a tool call — bad JSON, missing
 * fields, any thrown error — the call is DENIED.
 *
 * Blocks:
 *  (a) reading/printing .env.local or any env secret (Bash, Read, Grep, Edit, Write)
 *  (b) git push --force (and ALL git push during the run — local until review)
 *  (c) modification of frozen references: docs/SPEC.md, design/repo-seance-v2.html
 *  (d) destructive filesystem commands outside this repo
 *  (e) git operations against any remote other than origin
 */

const REPO = '/Users/alexanderdelossantos/CodeBlocks/repo-seance';
const WRITE_OK_PREFIXES = [
  REPO + '/',
  '/private/tmp/claude-501/',
  '/tmp/claude-501/',
  process.env.HOME + '/.claude/',
];
const FROZEN_RE = /docs\/SPEC\.md|(^|[\s"'/])SPEC\.md|repo-seance-v2\.html/i;
const SECRET_VARS = 'ANTHROPIC_API_KEY|GITHUB_TOKEN|UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN';

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `[run-guard] ${reason}`,
      },
    }),
  );
  process.exit(0);
}

function allow() {
  process.exit(0);
}

function isPathAllowedForWrite(p) {
  if (!p.startsWith('/')) return true; // relative paths resolve inside the repo cwd
  return WRITE_OK_PREFIXES.some((pre) => p === pre.slice(0, -1) || p.startsWith(pre));
}

function checkBash(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) {
    deny('no command string; failing closed');
  }
  const c = cmd;

  // (a) secrets — any .env mention other than .env.example
  if (/\.env/.test(c.replace(/\.env\.example/g, ''))) {
    deny('command references .env files; secrets must never be read or printed. .env.example is the only allowed reference; load env via package.json scripts.');
  }
  if (/\bprintenv\b/.test(c) || /\bexport\s+-p\b/.test(c) || /(^|[\s;|&])env(\s*$|\s*[|;&>])/.test(c)) {
    deny('command dumps the environment; secrets must never be printed.');
  }
  if (new RegExp(`\\$\\{?(${SECRET_VARS})`).test(c) || new RegExp(`\\benv\\.(${SECRET_VARS})`).test(c)) {
    deny('command references a secret env var value.');
  }
  if (/\bnode\b[^|;&]*(\s-e\b|\s-p\b|--eval|--print)/.test(c) && /process\.env/.test(c)) {
    deny('inline node eval touching process.env; secrets must never be printed.');
  }
  if (/\bgrep\b[^|;&]*\s-[a-zA-Z]*[rR]\b/.test(c) || /\brg\b[^|;&]*(--no-ignore|\s-uu)/.test(c)) {
    deny('recursive grep can read gitignored secrets; use rg (respects .gitignore) or the Grep tool.');
  }

  // (b) pushes — force pushes are forbidden; all pushes stay blocked until post-run review
  if (/\bgit\b[\s\S]*\bpush\b/.test(c)) {
    if (/(--force\b|--force-with-lease|--force-if-includes|(^|\s)-f\b)/.test(c)) {
      deny('git push --force is forbidden.');
    }
    deny('git push is blocked during the autonomous run; everything stays local until review.');
  }

  // (c) frozen reference documents
  if (FROZEN_RE.test(c) && /((^|[\s;|&])(rm|mv|cp|tee|truncate|shred)\b|>{1,2}|\bsed\s+-[a-zA-Z]*i|\bperl\s+-[a-zA-Z]*i)/.test(c)) {
    deny('docs/SPEC.md and design/repo-seance-v2.html are frozen; no mutation, move, or redirect targeting them. Reads are allowed.');
  }

  // (d) destructive commands / outside-repo damage
  if (/\bsudo\b/.test(c)) deny('sudo is not available to this run.');
  if (/\b(mkfs|diskutil\s+erase|dd\s+if=|shutdown\b|reboot\b)/.test(c)) {
    deny('destructive system command.');
  }
  if (/(^|[\s;|&])rm\b/.test(c)) {
    if (/\brm\b[^|;&]*(\s~\/|\s~\s|\s~$|\.\.)/.test(c)) deny('rm targeting home or parent paths.');
    if (/\brm\b[^|;&]*\s\.git(\/|\s|$|")/.test(c)) deny('rm targeting .git.');
    const seg = c.split(/[|;&]/).filter((s) => /(^|\s)rm\s/.test(s));
    for (const s of seg) {
      const toks = s.trim().split(/\s+/);
      for (let i = toks.indexOf('rm') + 1; i < toks.length && i > 0; i++) {
        const t = toks[i].replace(/^['"]|['"]$/g, '');
        if (t.startsWith('-')) continue;
        if (t.startsWith('/') && !WRITE_OK_PREFIXES.some((pre) => t.startsWith(pre))) {
          deny(`rm on absolute path outside the repo: ${t}`);
        }
      }
    }
  }
  if (/\.claude\/(settings\.json|hooks)/.test(c) && /((^|[\s;|&])(rm|mv|tee|truncate)\b|>{1,2}|\bsed\s+-[a-zA-Z]*i)/.test(c)) {
    deny('shell mutation of run governance files.');
  }

  // (e) remotes other than origin
  if (/\bgit\b[\s\S]*\bremote\b[\s\S]*\b(add|set-url|remove|rename|rm)\b/.test(c)) {
    deny('modifying git remotes is forbidden during the run.');
  }
  if (/\bgit\b[\s\S]*\bclone\b/.test(c)) deny('git clone (non-origin remote operation) is forbidden during the run.');
  const gitNet = c.match(/\bgit\b[^|;&]*\b(pull|fetch)\b([^|;&]*)/);
  if (gitNet) {
    const args = gitNet[2].trim().split(/\s+/).filter((t) => t && !t.startsWith('-'));
    if (args[0] && args[0] !== 'origin') {
      deny(`git ${gitNet[1]} against non-origin remote '${args[0]}'.`);
    }
  }

  allow();
}

function checkFileTool(toolName, input) {
  const p = input.file_path || input.notebook_path || input.path;
  if (!p) {
    // Grep with no path searches the repo via ripgrep, which respects .gitignore.
    if (toolName === 'Grep' || toolName === 'Glob') allow();
    deny('no path on a file-mutating tool; failing closed');
  }
  const norm = String(p);
  const lower = norm.toLowerCase();

  if (/\.env/.test(lower.replace(/\.env\.example/g, ''))) {
    deny('.env files are off-limits to all tools; only .env.example may be touched.');
  }

  const isFrozen =
    /(^|\/)docs\/spec\.md$/.test(lower) || /(^|\/)repo-seance-v2\.html$/.test(lower);
  const mutates = toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit';

  if (isFrozen && mutates) {
    deny('docs/SPEC.md and design/repo-seance-v2.html are frozen reference documents.');
  }
  if (mutates && !isPathAllowedForWrite(norm)) {
    deny(`write outside allowed roots: ${norm}`);
  }
  allow();
}

try {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const tool = payload.tool_name;
      const input = payload.tool_input || {};
      if (tool === 'Bash') return checkBash(input.command);
      if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return checkFileTool(tool, input);
      if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return checkFileTool(tool, input);
      // Matcher should only route the tools above; anything else fails closed.
      deny(`unexpected tool '${tool}'; failing closed`);
    } catch (e) {
      deny(`could not evaluate tool call (${e.message}); failing closed`);
    }
  });
  process.stdin.on('error', () => deny('stdin error; failing closed'));
} catch (e) {
  deny(`guard crashed (${e.message}); failing closed`);
}
