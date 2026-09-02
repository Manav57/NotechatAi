#!/usr/bin/env node
// compile-check.mjs — OPTIONAL real-compilation verifier for Tailwind v4 code.
//
// Unlike harness.mjs (dependency-free static heuristics), this actually COMPILES
// your code through real Tailwind v4 so mistakes surface as hard errors:
//   • HTML  → every utility class is checked against a real build (unknown utility = reported)
//   • SCSS  → Sass-compiled, then Tailwind resolves @apply (invalid @apply class = hard error)
//
// WHY MORE THAN "DID IT BUILD?": a green exit code is NOT proof Approach B worked. If the wrong
// build plugin processes your `<style lang="scss">`, or @apply/@reference reaches Tailwind in a
// context it doesn't transform, the compiler can emit those at-rules VERBATIM with no error — the
// browser then ignores them and the component ships unstyled. So we don't trust the exit code: we
// SCAN the produced CSS and FAIL on any unexpanded `@apply` or any literal `@reference` left behind.
//
// REQUIRES (install in your project; this script is NOT offline/dependency-free):
//   npm i -D tailwindcss @tailwindcss/cli sass
//
// USAGE:
//   node evals/compile-check.mjs [--theme path/to/theme.css] <file.html|file.scss> ...
//   node evals/compile-check.mjs examples/button/button.utility.html examples/button/button.bem.scss
// --theme defaults to ../templates/theme.css (the skill's canonical @theme). Point it at
// YOUR entry/theme CSS to validate against your own design tokens.
//
// Exit: 0 = all checked files OK · 1 = real failures · 2 = required deps missing (skipped).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// ── resolve optional deps; skip gracefully if absent ──────────────────────────
let sass, CLI, depsRoot;
try {
  sass = await import('sass');
  const pkgPath = require.resolve('@tailwindcss/cli/package.json');
  const pkg = require('@tailwindcss/cli/package.json');
  const bin = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
  CLI = path.join(path.dirname(pkgPath), bin);
  // Tailwind resolves `@import "tailwindcss"` relative to the input file, walking up for
  // node_modules — so the temp input MUST live under the dir that contains node_modules.
  const nm = pkgPath.replace(/\\/g, '/').indexOf('/node_modules/');
  depsRoot = nm > 0 ? pkgPath.slice(0, nm) : process.cwd();
} catch {
  console.error('compile-check: optional deps missing — install to use:\n  npm i -D tailwindcss @tailwindcss/cli sass');
  process.exit(2);
}

// ── args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let themePath = path.join(here, '..', 'templates', 'theme.css');
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--theme') themePath = args[++i];
  else files.push(args[i]);
}
if (!files.length) { console.error('usage: node evals/compile-check.mjs [--theme x.css] <file.html|file.scss> ...'); process.exit(1); }
if (!fs.existsSync(themePath)) { console.error('theme not found: ' + themePath); process.exit(1); }

const themeBody = fs.readFileSync(themePath, 'utf8').replace(/^@import\s+["']tailwindcss["'][^;]*;\s*/m, '');
const TMP = fs.mkdtempSync(path.join(depsRoot, '.twcc-'));
const esc = s => s.replace(/[:\/\[\]\(\),.#%!&*+~=><@| ]/g, c => '\\' + c);
const isMarker = c => /^(group|peer)(\/[A-Za-z0-9_-]+)?$/.test(c);

function tw(css) {
  const inp = path.join(TMP, 'in.css'), out = path.join(TMP, 'out.css');
  fs.writeFileSync(inp, css);
  try { execFileSync('node', [CLI, '-i', inp, '-o', out], { stdio: 'pipe' }); return { ok: true, out: fs.readFileSync(out, 'utf8') }; }
  catch (e) { return { ok: false, err: (e.stderr?.toString() || e.message || '').trim() }; }
}
const BASE = (tw('@import "tailwindcss" source(none);\n' + themeBody).out || '').length;
const genRule = c => { const r = tw('@import "tailwindcss" source(none);\n' + themeBody + '\n@source inline("' + c + '");'); return r.ok && r.out.length > BASE; };

function checkHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  const local = new Set();
  for (const sm of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    for (const cm of sm[1].matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) local.add(cm[1]);
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const set = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach(c => c && !c.includes('{') && set.add(c));
  const cand = [...set].filter(c => !isMarker(c) && !local.has(c));
  if (!cand.length) return [];
  const r = tw('@import "tailwindcss" source(none);\n' + themeBody + '\n@source inline("' + cand.join(' ') + '");');
  if (!r.ok) return ['build error: ' + r.err.split('\n')[0]];
  const bad = cand.filter(c => !r.out.includes('.' + esc(c)) && !genRule(c));
  return bad.length ? ['unknown/invalid utilities: ' + bad.join(', ')] : [];
}
function checkScss(file) {
  let src = fs.readFileSync(file, 'utf8').split('\n').filter(l => !/^\s*@reference\b/.test(l)).join('\n');
  let css;
  try { css = sass.compileString(src, { syntax: file.endsWith('.scss') ? 'scss' : 'css', style: 'expanded' }).css; }
  catch (e) { return ['sass error: ' + (e.message || '').split('\n')[0]]; }
  const r = tw('@import "tailwindcss" source(none);\n' + themeBody + '\n' + css);
  if (!r.ok) return ['@apply error: ' + r.err.split('\n').filter(Boolean).slice(0, 3).join(' | ')];
  // A clean compile is NOT enough: Tailwind can pass an unresolved @apply/@reference through verbatim
  // (no error) when the directive reaches it in a context it doesn't transform. Scan the PRODUCED CSS
  // and fail on any survivor — that's exactly what ships unstyled in the browser.
  const issues = [];
  if (/(^|[^A-Za-z-])@apply\b/.test(r.out)) issues.push('unexpanded @apply survived in compiled CSS — it shipped raw (a green build is NOT proof it expanded)');
  if (/@reference\b/.test(r.out)) issues.push('literal @reference survived in compiled CSS — @apply was not resolved against the theme');
  return issues;
}

let fails = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`✗ ${f} — not found`); fails++; continue; }
  const issues = /\.s?css$/.test(f) ? checkScss(f) : checkHtml(f);
  if (issues.length) { fails++; console.log(`✗ ${f}`); issues.forEach(i => console.log('    ' + i)); }
  else console.log(`✓ ${f}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${files.length} file(s) · ok ${files.length - fails} · failed ${fails}`);
process.exit(fails ? 1 : 0);
