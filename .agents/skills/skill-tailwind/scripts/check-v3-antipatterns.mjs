#!/usr/bin/env node
// check-v3-antipatterns.mjs — OPTIONAL detector of v3 patterns.
//
// The script is NOT required: the skill-tailwind skill works fully without it.
// No dependencies — only built-in Node modules (node:fs, node:path).
// Works offline, cross-platform (Windows/Unix).
//
// What it does: scans .css/.scss/.html etc. for Tailwind v3 syntax,
// removed or renamed in v4 (including @screen, removed in v4 — use @variant),
// and for each hit prints file:line, what it is and the v4 replacement.
// It also runs one optional Approach-B check: an @apply line that carries a
// per-group label comment (e.g. /* typography */). In Approach B the line
// order conveys the grouping, so these labels are noise and the convention
// forbids them — the check flags them. See resources/apply-grouping.md.
//
// Usage:
//   node scripts/check-v3-antipatterns.mjs [paths...]
//   (defaults to the current folder). exit 1 if anything is found (for CI), otherwise 0.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts',
  '.jsx', '.tsx', '.svelte', '.astro', '.vue',
  '.php', '.erb', '.haml', '.slim', '.twig',
  '.md', '.mdx', '.markdown',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'dist', 'build', 'out', '.next', '.nuxt', '.output',
  '.svelte-kit', '.astro', 'coverage', 'vendor', '.cache',
]);

// Each rule: regex + human-readable description + v4 replacement.
const RULES = [
  {
    re: /@tailwind\s+(base|components|utilities|screens|variants)\b/,
    what: '@tailwind directive (v3 entry point)',
    fix: 'v4: a single import — @import "tailwindcss";',
  },
  {
    re: /@screen\b/,
    what: '@screen directive removed (v3); v4 silently drops the wrapped rules',
    fix: 'v4: @variant md { @apply ...; } (or @media (width >= theme(--breakpoint-md)) { ... }).',
  },
  {
    re: /\bbg-opacity-\d/,
    what: 'bg-opacity-* utility removed',
    fix: 'v4: slash opacity modifier, e.g. bg-primary/50.',
  },
  {
    re: /\btext-opacity-\d/,
    what: 'text-opacity-* utility removed',
    fix: 'v4: slash modifier, e.g. text-foreground/75.',
  },
  {
    re: /\bborder-opacity-\d/,
    what: 'border-opacity-* utility removed',
    fix: 'v4: slash modifier, e.g. border-border/50.',
  },
  {
    re: /\b(ring|placeholder|divide)-opacity-\d/,
    what: '*-opacity-* utility removed',
    fix: 'v4: slash on the class itself, e.g. ring-ring/30.',
  },
  {
    re: /\bbg-gradient-to-(t|tr|r|br|b|bl|l|tl)\b/,
    what: 'bg-gradient-to-* renamed',
    fix: 'v4: bg-linear-to-* (plus bg-radial-*, bg-conic-*).',
  },
  {
    re: /\b(bg|text|border|ring|fill|stroke|from|via|to|shadow|outline)-\[--[\w-]/,
    what: 'CSS variable in an arbitrary value via square brackets',
    fix: 'v4: parentheses, e.g. bg-(--brand), not bg-[--brand].',
  },
  {
    re: /@layer\s+utilities\s*\{/,
    what: '@layer utilities { ... } for custom utilities (v3 way)',
    fix: 'v4: declare utilities with the @utility name { ... } directive.',
  },
  {
    re: /@layer\s+components\s*\{/,
    what: '@layer components { ... } (v3 way)',
    fix: 'v4: @utility for utilities; components — plain CSS/@apply without @layer.',
  },
  {
    re: /\bimportant\s*:\s*true\b/,
    what: 'important: true in the JS config (v3)',
    fix: 'v4: global important — in the import line: @import "tailwindcss" important;',
  },
  {
    re: /\bdarkMode\s*:/,
    what: 'darkMode: in the JS config (v3)',
    fix: 'v4: class-based dark mode via @custom-variant dark (&:where(.dark, .dark *));',
  },
  {
    re: /\b(safelist|content)\s*:\s*\[/,
    what: 'safelist/content in the JS config (v3)',
    fix: 'v4: sources are auto-detected; non-standard ones — @source "...", safelist — @source inline("...").',
  },
];

// --- Optional Approach-B check: per-group label comments on @apply ----------
//
// In BEM + @apply (Approach B) you group the @apply lines by property category
// in the canonical order (layout → sizing → spacing → background/borders/shape
// → typography → effects/motion → interaction, then states, then modifiers),
// ONE @apply line per group. The line order alone conveys the grouping, so the
// skill does NOT label the lines with category comments — only /* element: */,
// /* modifier: */ or short "why" comments are kept.
//
// This check enforces that: it flags any @apply line that carries a per-group
// label comment (e.g. /* typography */, /* spacing */) on the same line. The
// label is redundant noise the convention forbids — the fix is to delete it,
// not to "correct" it. See resources/apply-grouping.md.

// Category-label keywords. A same-line /* ... */ comment whose text is just one
// of these (a bare property-group label) is the forbidden kind. Element/modifier
// labels (`element:`, `modifier:`) and behavior notes are not matched here.
const GROUP_LABEL_RE =
  /\b(layout|position|sizing|size|spacing|background|borders?|shape|typography|type|font|effects?|motion|animation|transition|interaction|cursor|overflow|states?)\b/i;

// Inspect one source line for an @apply that carries a per-group label comment.
// Returns a finding-like object, or null. Only same-line comments are checked
// (keeps it cheap and low-false-positive — one nudge per line).
function checkApplyComment(line) {
  const apply = /@apply\s+[^;{}]+/.exec(line);
  if (!apply) return null;

  // The label comment may sit on the same line, before or after the @apply.
  const comment = /\/\*([^*]*)\*\//.exec(line);
  if (!comment) return null;

  const text = comment[1].trim();
  // Keep BEM element/modifier markers and behavior notes; only a bare
  // property-group label is the violation.
  if (/\b(element|modifier)\s*:/i.test(text)) return null;
  if (!GROUP_LABEL_RE.test(text)) return null;

  const label = GROUP_LABEL_RE.exec(text)[0];
  return {
    match: `/* ${text} */`,
    what: `per-group label comment "${label}" on an @apply line (Approach B forbids these)`,
    fix: 'remove the per-group label comment — the line order conveys the grouping.',
  };
}

const findings = [];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith('.');
}

function hasTextExt(name) {
  const lower = name.toLowerCase();
  for (const ext of TEXT_EXT) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function* walk(start) {
  let st;
  try {
    st = statSync(start);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (hasTextExt(start)) yield start;
    return;
  }
  if (!st.isDirectory()) return;

  const stack = [start];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) stack.push(full);
      } else if (entry.isFile() && hasTextExt(entry.name)) {
        yield full;
      }
    }
  }
}

function scanFile(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  // Rough binary cutoff: NUL byte.
  if (text.includes('\0')) return;

  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (m) {
        findings.push({
          file,
          line: i + 1,
          match: m[0],
          what: rule.what,
          fix: rule.fix,
        });
      }
    }

    // Optional Approach-B check: per-group label comment on an @apply line.
    const labelled = checkApplyComment(line);
    if (labelled) {
      findings.push({
        file,
        line: i + 1,
        match: labelled.match,
        what: labelled.what,
        fix: labelled.fix,
      });
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const targets = (args.length ? args : ['.']).map((p) => resolve(p));

  for (const target of targets) {
    for (const file of walk(target)) {
      scanFile(file);
    }
  }

  const cwd = process.cwd();
  for (const f of findings) {
    let rel = relative(cwd, f.file);
    if (rel.startsWith('..') || rel === '') rel = f.file;
    rel = rel.split(sep).join('/');
    console.log(`${rel}:${f.line}  ${f.match}`);
    console.log(`    ${f.what}`);
    console.log(`    -> ${f.fix}`);
    console.log('');
  }

  if (findings.length) {
    console.log(`check-v3-antipatterns: found ${findings.length} v3 pattern(s).`);
    process.exit(1);
  } else {
    console.log('check-v3-antipatterns: no v3 patterns found.');
    process.exit(0);
  }
}

main();
