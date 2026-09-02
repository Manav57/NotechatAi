#!/usr/bin/env node
// harness.mjs — runnable pass of the behavioral evals for the skill-tailwind skill.
//
// No dependencies — only Node built-in modules (node:fs, node:path).
// Runs offline, cross-platform (Windows/Unix).
//
// WHAT THIS IS. The README/cases in this folder describe the RUBRICS (what a human
// looks at when grading the output of an agent using the skill). This harness is
// their MACHINE-READABLE part: it does not "understand design", it catches concrete
// technical signals across the behavior axes (see evals/README.md "behavior axes"
// 1–11 and references/review.md):
//   1  v4, not v3            6  @apply grouping + BEM
//   3  semantic tokens       7  accessibility + full set of states
//   4  token-driven dark     8  no AI-slop
//   5  no dynamic            10 container vs viewport
//      class names           11 framework-agnosticism
// (axes 2 and 9 — "deliberate A/B choice" and "deference to the design system" — are
//  graded by a human against cases.md; the harness does not automate them, it just
//  does not get in the way.)
//
// HOW TO READ THE OUTPUT. For each candidate file a list of findings is printed:
//   FAIL  — a "Failure" anti-signal from the rubric (v3 form as the final answer,
//           dynamic class name, hex scatter, AI-slop, scrambled BEM …). Any FAIL
//           sinks the file (score 0 on the affected axis).
//   WARN  — a soft miss (1–2 missed signals: a state is missing, no
//           focus-visible, invalid:/peer-invalid: instead of user-invalid: …).
//   INFO  — an observation/hint, does not affect the score.
// A file is considered to have passed (pass) if it has NO FAIL and NO WARN; partial —
// if it has only WARN; fail — if it has at least one FAIL.
//
// IMPORTANT about fixtures. Files in evals/fixtures/ are intentionally "bad" v3 INPUT
// for migration/review cases, NOT agent output. The harness recognizes them by path
// (a `fixtures` segment) or by the `FIXTURE — INPUT ONLY` marker in the first lines and
// marks them as INPUT: findings are printed (a useful self-test of the detectors), but
// they do not count toward the overall verdict of the run. To check fixtures strictly,
// add the --strict-fixtures flag.
//
// Usage:
//   node evals/harness.mjs <files...>            run specific files/folders
//   node evals/harness.mjs --json <files...>     machine-readable JSON to stdout
//   node evals/harness.mjs --quiet <files...>    summary only
//   node evals/harness.mjs --strict-fixtures …   count fixtures too
//   (no arguments — current folder). exit 1 if there is at least one FAIL
//   in a non-fixture file (handy for CI), otherwise 0.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

/* ──────────────────────────── file walk ──────────────────────────── */

// Candidates are agent output: markup and styles. We do not scan scripts/docs.
const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.scss', '.sass',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'dist', 'build', 'out', '.next', '.nuxt', '.output',
  '.svelte-kit', '.astro', 'coverage', 'vendor', '.cache',
]);

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

/* ──────────────────────────── text utilities ─────────────────────────── */

const SEV = { FAIL: 'FAIL', WARN: 'WARN', INFO: 'INFO' };

// Roughly strip the contents of /* ... */ and // ... — so the detectors do not catch
// on intentional "before→after" pairs in comments. We preserve the lines by
// length (replacing with spaces) so line/column numbers do not shift.
function stripComments(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  return out;
}

// HTML comments <!-- ... --> are stripped the same way (by length), so notes in
// the file header and before→after pairs are not counted as code.
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

function isFixture(file, rawText) {
  const norm = file.split(sep).join('/');
  if (/\/fixtures\//.test(norm) || /(^|\/)fixtures$/.test(norm)) return true;
  const head = rawText.slice(0, 400);
  return /FIXTURE\s*[—-]\s*INPUT ONLY/i.test(head) || /INPUT ONLY/i.test(head);
}

// Extract all class="..." attribute values (including multi-line ones).
function classAttrValues(html) {
  const out = [];
  const re = /class\s*=\s*"([^"]*)"|class\s*=\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1] != null ? m[1] : m[2]);
  }
  return out;
}

/* ──────────────────────────── axis 1: v4, not v3 ───────────────────────── */
// Each rule is regex + what it is + the v4 replacement. A match in CODE (not in a
// comment) is a "Failure" anti-signal of axis 1.
const V3_RULES = [
  { re: /@tailwind\s+(base|components|utilities|screens|variants)\b/,
    what: '@tailwind directive (v3 entry point)',
    fix: 'v4: a single import — @import "tailwindcss";', axis: 1 },
  { re: /\bbg-opacity-\d/, what: 'bg-opacity-* removed',
    fix: 'v4: slash modifier, e.g. bg-primary/50.', axis: 1 },
  { re: /\btext-opacity-\d/, what: 'text-opacity-* removed',
    fix: 'v4: slash modifier, e.g. text-foreground/75.', axis: 1 },
  { re: /\bborder-opacity-\d/, what: 'border-opacity-* removed',
    fix: 'v4: slash modifier, e.g. border-border/50.', axis: 1 },
  { re: /\b(ring|placeholder|divide)-opacity-\d/, what: '*-opacity-* removed',
    fix: 'v4: slash on the class itself, e.g. ring-ring/30.', axis: 1 },
  { re: /\bbg-gradient-to-(t|tr|r|br|b|bl|l|tl)\b/, what: 'bg-gradient-to-* renamed',
    fix: 'v4: bg-linear-to-* (plus bg-radial-*, bg-conic-*).', axis: 1 },
  { re: /\b(bg|text|border|ring|fill|stroke|from|via|to|shadow|outline)-\[--[\w-]/,
    what: 'CSS variable via square brackets',
    fix: 'v4: parentheses — bg-(--brand), not bg-[--brand].', axis: 1 },
  { re: /@layer\s+utilities\s*\{/, what: '@layer utilities { … } for a custom utility (v3)',
    fix: 'v4: @utility name { … }.', axis: 1 },
  { re: /\bimportant\s*:\s*true\b/, what: 'important: true in the JS config (v3)',
    fix: 'v4: global — @import "tailwindcss" important; (do not confuse with the bg-danger suffix!).', axis: 1 },
  { re: /\bdarkMode\s*:/, what: 'darkMode: in the JS config (v3)',
    fix: 'v4: @custom-variant dark (&:where(.dark, .dark *));', axis: 1 },
  { re: /\b(safelist|content)\s*:\s*\[/, what: 'safelist/content in the JS config (v3)',
    fix: 'v4: sources are auto-detected; the safelist — @source inline("…").', axis: 1 },
];

function checkV3(lines, push) {
  for (let i = 0; i < lines.length; i++) {
    for (const rule of V3_RULES) {
      const m = rule.re.exec(lines[i]);
      if (m) {
        push(SEV.FAIL, rule.axis, i + 1, m[0],
          `${rule.what}`, rule.fix);
      }
    }
  }
}

/* ─────────────────── axis 5: dynamic class names ───────────────── */
const DYN_PREFIX = [
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

const RE_DYN_INTERP = new RegExp('\\b(' + DYN_PREFIX + ')-(?=\\$\\{|\\{\\{|#\\{|<%)', 'g');
const RE_DYN_CONCAT = new RegExp(
  '(["\'])\\s*[\\w:/\\[\\]-]*?(' + DYN_PREFIX + ')-\\1\\s*[+.]\\s*(?=[^\\s+.])', 'g');

function checkDynamicClasses(lines, push) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [re, advice] of [
      [RE_DYN_INTERP, 'class name assembled via interpolation — Tailwind detection is literal, the class will not end up in the CSS. ' +
        'Map value→full class string; @source inline("…") is a last resort.'],
      [RE_DYN_CONCAT, 'class name assembled via string concatenation — it will not end up in the production CSS. ' +
        'Use full literals (a dictionary) or @source inline("…").'],
    ]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        push(SEV.FAIL, 5, i + 1, m[0], 'dynamic class name', advice);
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    }
  }
}

/* ───────────────── axis 3: tokens, not an arbitrary scatter ───────────────── */
// We count repeating hex (#rrggbb) and arbitrary values. Once or twice is
// acceptable (INFO/frugal arbitrary), a systematic repeat is WARN/FAIL.
function checkTokensNotHex(text, push) {
  // hex colors in any form (including inside text-[#...]/bg-[#...])
  const hexCounts = new Map();
  const reHex = /#[0-9a-fA-F]{3,8}\b/g;
  let m;
  while ((m = reHex.exec(text)) !== null) {
    const key = m[0].toLowerCase();
    hexCounts.set(key, (hexCounts.get(key) || 0) + 1);
  }
  let repeated = 0;
  for (const [hex, n] of hexCounts) {
    if (n >= 2) {
      repeated++;
      push(SEV.FAIL, 3, null, hex,
        `hex value ${hex} repeats ${n}×`,
        'repeat → semantic token @theme (--color-…), in markup bg-primary/text-foreground/…');
    } else {
      push(SEV.INFO, 3, null, hex,
        `one-off hex ${hex}`,
        'a one-off value is acceptable; on repeat/meaning — promote to a @theme token.');
    }
  }

  // arbitrary utilities with "spacing"/radius, repeating literally.
  const arbCounts = new Map();
  const reArb = /\b(?:p[xytrbl]?|m[xytrbl]?|gap|w|h|size|rounded|top|left|right|bottom|inset)-\[[^\]]+\]/g;
  while ((m = reArb.exec(text)) !== null) {
    arbCounts.set(m[0], (arbCounts.get(m[0]) || 0) + 1);
  }
  for (const [arb, n] of arbCounts) {
    if (n >= 3) {
      push(SEV.WARN, 3, null, arb,
        `arbitrary value ${arb} repeats ${n}×`,
        'repeat → @theme token (--spacing/--radius-…) or a utility from the scale.');
    }
  }
  return repeated;
}

/* ───────────── axis 4: token-driven dark, not a scatter of dark: ───────────── */
function checkDarkMode(text, classValues, push) {
  // count the number of dark: variants in the markup/utility classes
  let darkCount = 0;
  const re = /(^|[\s"'])dark:/g;
  let m;
  while ((m = re.exec(text)) !== null) darkCount++;

  const hasCustomVariant = /@custom-variant\s+dark\b/.test(text);
  const hasDarkOverride = /\.dark\s*[,{]/.test(text) || /\.dark\b[^:]/.test(text);

  // A scatter of dark: on the markup is an anti-signal, IF there is no token-driven
  // base and there are many variants (threshold 6, so a single meaningful dark: is not penalized).
  if (darkCount >= 6 && !hasDarkOverride) {
    push(SEV.WARN, 4, null, `dark: ×${darkCount}`,
      'dark mode assembled as a scatter of dark: variants on the markup',
      'token-driven: @custom-variant dark + .dark{ --color-…: … } overrides tokens; markup without dark:.');
  }
  if (darkCount >= 1 && hasCustomVariant && !hasDarkOverride) {
    push(SEV.INFO, 4, null, `dark: ×${darkCount}`,
      'there is @custom-variant dark, but no .dark token overrides are visible',
      'prefer overriding tokens under .dark rather than hanging dark: on every element.');
  }
  return darkCount;
}

/* ─────── axis 6: BEM convention + @apply grouping (SCSS/CSS) ───────── */
function checkBemAndApply(text, lines, push, ext) {
  const isStyle = ext === '.scss' || ext === '.sass' || ext === '.css';

  // @apply inside @keyframes — forbidden by the engine.
  const kf = /@keyframes[^{]*\{[\s\S]*?\}/g;
  let m;
  while ((m = kf.exec(text)) !== null) {
    if (/@apply\b/.test(m[0])) {
      push(SEV.FAIL, 6, null, '@apply in @keyframes',
        '@apply inside @keyframes', 'the engine forbids this — animate with plain CSS properties.');
    }
  }

  // "dump": a single @apply line with a suspiciously large number of utilities without
  // breaking them into groups. We count the tokens after @apply on a single line.
  if (isStyle) {
    for (let i = 0; i < lines.length; i++) {
      const a = /@apply\s+([^;]+);/.exec(lines[i]);
      if (a) {
        const utils = a[1].trim().split(/\s+/).filter(Boolean);
        if (utils.length >= 8) {
          push(SEV.WARN, 6, i + 1, `@apply …(${utils.length})`,
            'many utilities dumped into a single @apply line without grouping',
            'split @apply into lines by property-order (layout→sizing→…→interaction) with comments.');
        }
      }
    }
    // @apply of one component class into another (a nested @apply of your own class)
    // — heuristic: @apply <word-without-utility-hyphens>, starting not like a utility.
    // Here we only catch a direct @apply inside @apply is syntactically impossible,
    // so we check @apply COMPONENT-CLASS-NAME (camelCase/BEM) — a common smell.
    for (let i = 0; i < lines.length; i++) {
      const a = /@apply\s+([^;]+);/.exec(lines[i]);
      if (!a) continue;
      for (const u of a[1].trim().split(/\s+/)) {
        if (/_/.test(u) || /^[a-z]+[A-Z]/.test(u)) {
          push(SEV.WARN, 6, i + 1, u,
            `@apply looks like a component class (${u}), not a utility`,
            '@apply is for utilities, not for your own component classes; extract the shared set of utilities.');
        }
      }
    }
  }

  // BEM convention: we look for class names with BEM traits and check the separators.
  // The source of names is selectors in SCSS/CSS and class="" values in HTML.
  const names = new Set();
  if (isStyle) {
    const reSel = /(^|[\s,>{])\.([A-Za-z][\w-]*)/g;
    while ((m = reSel.exec(text)) !== null) names.add(m[2]);
    // nested &_el / &-mod
    const reNest = /&([_-][A-Za-z][\w]*)/g;
    while ((m = reNest.exec(text)) !== null) names.add('PARENT' + m[1]);
  } else {
    for (const cv of classAttrValues(text)) {
      for (const n of cv.split(/\s+/)) if (n) names.add(n.split(':').pop());
    }
  }

  for (const n of names) {
    // Skip NON-BEM names: utility classes with an arbitrary value `name-[...]`
    // (there `_` is space encoding in Tailwind, not a BEM separator), and
    // names with digits at the boundary (pseudo-utilities). A BEM candidate is the alphabetic parts.
    if (/\[/.test(n) || /-\d/.test(n)) continue;
    // element-of-element chain: two or more '_'
    const underscores = (n.match(/_/g) || []).length;
    if (underscores >= 2) {
      push(SEV.FAIL, 6, null, n,
        `BEM chain "_a_b" in the name ${n}`,
        'elements are always from the block: cardList_itemTitle, not cardList_item_title.');
    }
    // snake_case in a modifier: the modifier must go through a hyphen, not '_'.
    // Error trait: '-' stands INSIDE the part before '_' as an element separator,
    // i.e. the element is formed with a hyphen (block-item instead of block_item) — we catch this
    // as potential confusion only for names that clearly look like BEM (have both _ and -).
    // Also here: snake_case of a multi-word part (item_title) is already covered above.
  }
}

/* ───────── axis 7: accessibility + full set of states (HTML) ───────── */
function checkA11yStates(text, lines, push) {
  // user-invalid:/user-valid: instead of invalid:/peer-invalid: for form validation.
  // invalid:/peer-invalid: fire BEFORE input — that is an anti-signal.
  for (let i = 0; i < lines.length; i++) {
    if (/(^|[\s"'(])(?:peer-)?invalid:/.test(lines[i]) && !/user-invalid:/.test(lines[i])) {
      push(SEV.WARN, 7, i + 1, 'invalid:',
        'invalid:/peer-invalid: for form validation',
        'use user-invalid:/user-valid: — they fire after input, not before it.');
    }
  }

  // outline-none / outline-0 without a ring replacement — loss of visible focus.
  // The legitimate "wrapper draws the ring" pattern (input inside a control with
  // :has(:focus-visible)/focus-within) is NOT penalized: if there is a visible focus
  // replacement somewhere in the file — we consider focus handled at the component level.
  const fileHasFocusRing =
    /focus-visible:(?:outline-ring|outline-2|ring-)/.test(text) ||
    /&:focus-visible\b/.test(text) ||
    /:has\(:focus-visible\)/.test(text) ||
    /has-\[:focus(?:-visible)?\]:(?:ring-|outline-)/.test(text) ||
    /\bfocus-within:(?:outline-ring|outline-2|ring-)/.test(text) ||
    /&:focus-within\b/.test(text);
  for (let i = 0; i < lines.length; i++) {
    if (/\boutline-none\b|\boutline-0\b/.test(lines[i])) {
      const ctx = (lines[i - 1] || '') + lines[i] + (lines[i + 1] || '');
      const localReplacement = /ring-|outline-ring|outline-2|outline-\[/.test(ctx);
      if (!localReplacement && !fileHasFocusRing) {
        push(SEV.WARN, 7, i + 1, 'outline-none',
          'outline removed without a visible replacement',
          'do not kill focus without a replacement: focus-visible:outline-ring / ring-2 ring-ring.');
      }
    }
  }

  // Interactivity on a <div> with onclick instead of <button>.
  for (let i = 0; i < lines.length; i++) {
    if (/<div\b[^>]*\bonclick=/.test(lines[i])) {
      push(SEV.WARN, 7, i + 1, '<div onclick>',
        'click handler on a <div>',
        'use a semantic <button type="button"> (focus/keyboard/role — for free).');
    }
  }

  // <input>/<textarea> without a label — a soft miss. A label counts if there is
  // ANY of the association options: an explicit <label for>, aria-label/labelledby, OR
  // a WRAPPING <label>…<input>…</label> (an implicit association — also valid).
  const hasInput = /<(input|textarea|select)\b/i.test(text);
  if (hasInput) {
    const hasLabelFor = /<label\b[^>]*\bfor=/i.test(text);
    const hasAriaLabel = /aria-label=|aria-labelledby=/i.test(text);
    // wrapping label: there is an input field between <label ...> and </label>
    const hasWrappingLabel =
      /<label\b[^>]*>[\s\S]*?<(input|textarea|select)\b[\s\S]*?<\/label>/i.test(text);
    if (!hasLabelFor && !hasAriaLabel && !hasWrappingLabel) {
      push(SEV.WARN, 7, null, '<input>',
        'input field without a label (no <label for>, aria-label, or wrapping <label>)',
        'link the label: <label for="id"> ↔ <input id> or <label><input>…</label>; the error — aria-describedby + user-invalid:.');
    }
  }

  // Interactive elements: we check state coverage by utility classes.
  // We take elements with hover: and look at whether there is focus-visible:/active:/disabled:.
  const hasHover = /\bhover:/.test(text);
  if (hasHover) {
    if (!/focus-visible:/.test(text) && !/&:focus-visible/.test(text)) {
      push(SEV.WARN, 7, null, 'focus-visible',
        'there is hover, but no focus-visible is visible',
        'keyboard focus is mandatory: focus-visible:outline-ring (not focus:).');
    }
    if (!/disabled:/.test(text) && !/&:disabled/.test(text) && !/\bdisabled\b/.test(text)) {
      push(SEV.INFO, 7, null, 'disabled',
        'there is hover, but no disabled state is visible',
        'for interactive components add disabled:opacity-50 disabled:pointer-events-none.');
    }
  }

  // inert as a variant (inert:) — such a variant does NOT exist (inert is an attribute).
  for (let i = 0; i < lines.length; i++) {
    if (/\binert:/.test(lines[i])) {
      push(SEV.FAIL, 7, i + 1, 'inert:',
        'the inert: variant does not exist',
        'inert is a native HTML attribute (<div inert>), not a Tailwind variant.');
    }
  }
}

/* ───────────── axis 8: no AI-slop (visual neutrality) ─────────── */
function checkAiSlop(text, push) {
  // purple-blue / gradient "for looks"
  const slop = [
    { re: /\bfrom-(purple|violet|fuchsia|indigo)-\d+\b[\s\S]{0,80}\bto-(blue|sky|cyan|indigo)-\d+\b/,
      what: 'purple→blue gradient (AI-slop)',
      fix: 'neutral semantic tokens; a decorative gradient — only from the design system.' },
    { re: /\bto-(purple|violet|fuchsia|indigo)-\d+\b[\s\S]{0,80}\bfrom-(blue|sky|cyan|indigo)-\d+\b/,
      what: 'blue→purple gradient (AI-slop)',
      fix: 'neutral semantic tokens instead of a "pretty" gradient.' },
    { re: /\bbackdrop-blur(-\w+)?\b[\s\S]{0,80}\bbg-\w+\/(?:[1-5]?\d)\b/,
      what: 'glassmorphism (backdrop-blur + semi-transparent background for the effect)',
      fix: 'an opaque surface bg-card/border-border; glass is not the default.' },
    { re: /\bbg-(?:white|black)\/(?:[1-6]?\d)\b[\s\S]{0,80}\bbackdrop-blur/,
      what: 'glassmorphism (semi-transparent background + backdrop-blur)',
      fix: 'bg-card instead of a glass backing.' },
  ];
  for (const s of slop) {
    if (s.re.test(text)) {
      push(SEV.FAIL, 8, null, '(slop)', s.what, s.fix);
    }
  }

  // excessive rounding out of place: rounded-[…large…] or rounded-3xl+ on
  // non-avatars. Soft: WARN.
  const reBigRound = /\brounded-(?:\[(?:[2-9]\d|\d{3,})px\]|[3-9]xl)\b/g;
  let m;
  const seen = new Set();
  while ((m = reBigRound.exec(text)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      push(SEV.WARN, 8, null, m[0],
        `excessive rounding ${m[0]}`,
        'radii from the scale rounded-sm/md/lg/xl; rounded-full — only for avatars/pills.');
    }
  }

  // random arbitrary shadows instead of shadow-xs/sm/...
  const reArbShadow = /\bshadow-\[[^\]]+\]/g;
  while ((m = reArbShadow.exec(text)) !== null) {
    push(SEV.INFO, 8, null, m[0],
      `arbitrary shadow ${m[0]}`,
      'prefer shadow-xs/sm/md/lg from the scale; on repeat — into a token.');
  }
}

/* ───────────── axis 10: container vs viewport queries ──────────────── */
function checkContainerQueries(text, push) {
  // @-variants (@sm:/@md:) are used — @container must be declared.
  const usesAtVariant = /[\s"'(@](@(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl))(?:\/[\w-]+)?:/.test(text);
  const declaresContainer = /(^|[\s"'])@container\b|@container\s*\{|container-type\s*:/.test(text);
  if (usesAtVariant && !declaresContainer) {
    push(SEV.WARN, 10, null, '@sm:/@md:',
      'container @-variants without a declared @container',
      'mark the container with the @container class (or container-type), otherwise @sm:/@md: will not work.');
  }
}

/* ──────────────── axis 11: framework-agnosticism ───────────────────── */
function checkFrameworkLeak(text, lines, push) {
  const leaks = [
    { re: /\bv-(if|for|else|else-if|bind|on|model|show|html|text|slot)\b|:[\w-]+="|@click=|@submit=/,
      what: 'Vue directives in the markup', fix: 'pure HTML: remove v-*/:bind/@on.' },
    { re: /\bclassName=|\buseState\b|\buseEffect\b|=>\s*\{|\bjsx\b/,
      what: 'React/JSX constructs', fix: 'pure HTML + class="…", without className/hooks/JSX.' },
    { re: /\b(svelte|sveltekit)\b|\$:\s|on:click=|\{#if\b|\{#each\b/,
      what: 'Svelte syntax', fix: 'pure HTML/CSS, without Svelte blocks.' },
    { re: /\b(Nuxt|Pinia|defineComponent|defineProps|defineNuxt)\b/,
      what: 'mention of Nuxt/Pinia/define*', fix: 'framework-agnostic: only HTML + CSS/SCSS.' },
    { re: /<(template|script\s+setup|script\s+lang)\b/,
      what: 'framework wiring (<template>/<script setup>)', fix: 'leave pure markup.' },
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const l of leaks) {
      const m = l.re.exec(lines[i]);
      if (m) push(SEV.FAIL, 11, i + 1, m[0], l.what, l.fix);
    }
  }
  // cn()/clsx/cva/tailwind-merge — allowed ONLY as an optional insert; in pure
  // HTML/CSS output it is superfluous → WARN (not FAIL, since it is just an "add-on").
  for (let i = 0; i < lines.length; i++) {
    const m = /\b(clsx|tailwind-merge|twMerge|\bcva\(|\bcn\()/.exec(lines[i]);
    if (m) {
      push(SEV.WARN, 11, i + 1, m[0],
        `JS helper ${m[0]} in the output`,
        'cn()/clsx/cva/tailwind-merge — only an optional insert "if you are in a JS framework", not the foundation.');
    }
  }
}

/* ──────────────────────────── file evaluation ───────────────────────────── */

function evalFile(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  if (raw.includes('\0')) return null; // binary

  const ext = '.' + (basename(file).toLowerCase().split('.').pop() || '');
  const fixture = isFixture(file, raw);

  // Code without comments — detectors must not catch on before→after pairs.
  let code = stripComments(raw);
  if (ext === '.html' || ext === '.htm') code = stripHtmlComments(code);
  const lines = code.split(/\r\n|\r|\n/);
  const classValues = classAttrValues(code);

  const findings = [];
  const push = (sev, axis, line, match, what, fix) => {
    findings.push({ sev, axis, line, match, what, fix });
  };

  // Run the detectors across the axes.
  checkV3(lines, push);
  checkDynamicClasses(lines, push);
  checkTokensNotHex(code, push);
  checkDarkMode(code, classValues, push);
  checkBemAndApply(code, lines, push, ext);
  checkAiSlop(code, push);
  checkContainerQueries(code, push);
  if (ext === '.html' || ext === '.htm') {
    checkA11yStates(code, lines, push);
    checkFrameworkLeak(code, lines, push);
  } else {
    // in SCSS we also check states (focus-visible/inert:/invalid:)
    checkA11yStates(code, lines, push);
  }

  const fails = findings.filter((f) => f.sev === SEV.FAIL).length;
  const warns = findings.filter((f) => f.sev === SEV.WARN).length;

  let verdict; // 'pass' | 'partial' | 'fail'
  if (fails > 0) verdict = 'fail';
  else if (warns > 0) verdict = 'partial';
  else verdict = 'pass';

  return { file, ext, fixture, findings, fails, warns, verdict };
}

/* ──────────────────────────── output ──────────────────────────────────── */

function relPath(file) {
  const cwd = process.cwd();
  let rel = relative(cwd, file);
  if (rel.startsWith('..') || rel === '') rel = file;
  return rel.split(sep).join('/');
}

const SCORE = { pass: 2, partial: 1, fail: 0 };

function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const paths = argv.filter((a) => !a.startsWith('--'));
  const asJson = flags.has('--json');
  const quiet = flags.has('--quiet');
  const strictFixtures = flags.has('--strict-fixtures');

  const targets = (paths.length ? paths : ['.']).map((p) => resolve(p));

  const results = [];
  for (const target of targets) {
    for (const file of walk(target)) {
      const r = evalFile(file);
      if (r) results.push(r);
    }
  }

  // Count toward the run verdict: non-fixture files (or all with --strict-fixtures).
  const scored = results.filter((r) => strictFixtures || !r.fixture);
  const anyFail = scored.some((r) => r.fails > 0);

  if (asJson) {
    const out = {
      summary: {
        files: results.length,
        scored: scored.length,
        pass: scored.filter((r) => r.verdict === 'pass').length,
        partial: scored.filter((r) => r.verdict === 'partial').length,
        fail: scored.filter((r) => r.verdict === 'fail').length,
        anyFail,
      },
      files: results.map((r) => ({
        file: relPath(r.file),
        fixture: r.fixture,
        verdict: r.verdict,
        score: SCORE[r.verdict],
        counts: { fail: r.fails, warn: r.warns },
        findings: r.findings.map((f) => ({
          severity: f.sev, axis: f.axis, line: f.line,
          match: f.match, what: f.what, fix: f.fix,
        })),
      })),
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(anyFail ? 1 : 0);
  }

  for (const r of results) {
    const tag = r.fixture ? ' [INPUT/fixture — not counted]' : '';
    const head = `${relPath(r.file)} — ${r.verdict.toUpperCase()} (FAIL:${r.fails} WARN:${r.warns})${tag}`;
    if (quiet) {
      console.log(head);
      continue;
    }
    console.log(head);
    for (const f of r.findings) {
      if (f.sev === SEV.INFO && r.fixture) continue; // do not spam INFO on fixtures
      const loc = f.line != null ? `:${f.line}` : '';
      console.log(`  ${f.sev}  [axis ${f.axis}]${loc}  ${f.match}`);
      console.log(`        ${f.what}`);
      console.log(`        -> ${f.fix}`);
    }
    console.log('');
  }

  const s = {
    files: results.length,
    scored: scored.length,
    pass: scored.filter((r) => r.verdict === 'pass').length,
    partial: scored.filter((r) => r.verdict === 'partial').length,
    fail: scored.filter((r) => r.verdict === 'fail').length,
  };
  console.log(
    `harness: files ${s.files} (counted ${s.scored}) · ` +
    `pass ${s.pass} · partial ${s.partial} · fail ${s.fail}`,
  );
  if (results.length !== scored.length) {
    console.log(`         (${results.length - scored.length} fixture file(s) shown as INPUT and not counted)`);
  }
  process.exit(anyFail ? 1 : 0);
}

main();
