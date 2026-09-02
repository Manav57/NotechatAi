#!/usr/bin/env node
// lint-dynamic-classes.mjs — OPTIONAL, heuristic linter.
//
// The script is NOT required: the skill-tailwind skill works fully without it.
// No dependencies — only built-in Node modules (node:fs, node:path).
// Works offline, cross-platform (Windows/Unix).
//
// What it does: recursively walks text files and looks for DYNAMICALLY assembled
// Tailwind-like class names — interpolation (`bg-${...}`) and concatenation
// ("text-" + variable). Tailwind v4 scans sources as FLAT TEXT and does not
// "run" your code: a class assembled from pieces will not make it into the production CSS.
//
// Heuristic => false positives are possible. Fix it like this:
//   1) write FULL class names and select them through a dictionary mapping, or
//   2) list the variants in CSS: `@source inline("bg-{primary,accent}/{80,90}")`.
//
// Usage:
//   node scripts/lint-dynamic-classes.mjs [paths...]
//   (defaults to the current folder). exit 1 if anything is found (for CI), otherwise 0.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Text extensions worth scanning.
const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts',
  '.jsx', '.tsx', '.svelte', '.astro', '.vue',
  '.php', '.erb', '.haml', '.slim', '.twig', '.blade.php',
  '.md', '.mdx', '.markdown',
]);

// Directories we always skip (artifacts / VCS).
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'dist', 'build', 'out', '.next', '.nuxt', '.output',
  '.svelte-kit', '.astro', 'coverage', 'vendor', '.cache',
]);

// Set of Tailwind-like utility prefixes (intentionally broad, but not exhaustive).
const PREFIX = [
  'bg', 'text', 'border', 'ring', 'outline', 'fill', 'stroke', 'shadow',
  'from', 'via', 'to', 'accent', 'caret', 'decoration', 'divide',
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'w', 'h', 'size', 'min', 'max', 'gap', 'space',
  'grid', 'col', 'row', 'flex', 'basis', 'order', 'justify', 'items', 'content', 'self',
  'rounded', 'opacity', 'font', 'leading', 'tracking', 'align',
  'translate', 'scale', 'rotate', 'skew', 'origin', 'z', 'inset', 'top', 'right', 'bottom', 'left',
  'hover', 'focus', 'active', 'disabled', 'group', 'peer', 'dark', 'aria', 'data',
].join('|');

// 1) Interpolation in a template string:  `... bg-${...} ...`  or  `... text-{{ ... }} ...`
//    The prefix ends with a hyphen, immediately followed by an interpolation opening.
const RE_INTERP = new RegExp(
  '\\b(' + PREFIX + ')-(?=\\$\\{|\\{\\{|#\\{|<%)',
  'g',
);

// 2) String concatenation:  "text-" + variable   /   'bg-' .  $var   (PHP dot too)
//    A string literal "tail" that ends with a hyphen, then + or . and a non-quote.
const RE_CONCAT = new RegExp(
  '(["\'])\\s*[\\w:/\\[\\]-]*?(' + PREFIX + ')-\\1\\s*[+.]\\s*(?=[^\\s+.])',
  'g',
);

const ADVICE_INTERP =
  'dynamically assembled class via interpolation — Tailwind will not "run" it. ' +
  'Write full class names and select via a dictionary, or list the variants in CSS: @source inline("bg-{primary,accent}").';
const ADVICE_CONCAT =
  'class assembled by string concatenation — it will not make it into the production CSS. ' +
  'Use full literal classes (dictionary mapping) or @source inline("...").';

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
    checkLine(file, i + 1, line, RE_INTERP, ADVICE_INTERP);
    checkLine(file, i + 1, line, RE_CONCAT, ADVICE_CONCAT);
  }
}

function checkLine(file, lineNo, line, re, advice) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    const col = m.index;
    const snippet = line.slice(Math.max(0, col - 4), col + 48).trim();
    findings.push({ file, line: lineNo, snippet, advice });
    if (re.lastIndex === m.index) re.lastIndex++; // protection against infinite loop
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
    console.log(`${rel}:${f.line}`);
    console.log(`    ${f.snippet}`);
    console.log(`    -> ${f.advice}`);
    console.log('');
  }

  if (findings.length) {
    console.log(
      `lint-dynamic-classes: found ${findings.length} potentially dynamic class(es). ` +
        'This is a heuristic — check each location manually.',
    );
    process.exit(1);
  } else {
    console.log('lint-dynamic-classes: no dynamically assembled classes found.');
    process.exit(0);
  }
}

main();
