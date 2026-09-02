# Evals — quality checks for the `skill-tailwind` skill

These checks answer a single question: **does the skill change the agent's behavior**. Not "does the model
know Tailwind at all" (the base model knows something even without the skill), but — **with the skill loaded** the agent
starts emitting v4 instead of v3, deliberately chooses between approaches A/B, introduces semantic
tokens instead of hex, makes dark mode token-driven, rejects dynamic class names,
groups `@apply` correctly, keeps the BEM convention, covers accessibility and states, doesn't drag in
AI-slop, and **maps** an external design system rather than redefining it.

These are **behavioral evals**: we compare the agent's output **with the skill** against a rubric. The baseline (without
the skill) is useful for contrast — if a case passes the same way with and without the skill, the case isn't diagnostic.

> Token names in the rubrics are the canonical semantic ones (`bg-primary`/`text-primary-foreground`,
> `bg-muted`/`text-muted-foreground`, `bg-card`/`text-card-foreground`, `border-border`, `bg-input`,
> `ring-ring`/`outline-ring`, `bg-success`/`bg-warning`/`bg-danger` + `*-foreground`,
> `rounded-sm/md/lg/xl`). The values are placeholders; only the **names** are stable.

---

## What exactly we check (behavior axes)

Each case in `cases.md` hits one or two axes. Full coverage of the axes:

1. **v4, not v3.** `@import "tailwindcss"` instead of `@tailwind …`; `@theme` instead of `tailwind.config.js`;
   `@utility` instead of `@layer utilities`; slash-opacity instead of `bg-opacity-*`; `bg-linear-to-*`
   instead of `bg-gradient-to-*`; `bg-(--var)` instead of `bg-[--var]`; the renames `shadow-sm→shadow-xs`,
   `rounded-sm→rounded-xs`. v3 is acceptable **only** as the "before/anti-pattern" in a before→after pair.
2. **Two approaches A/B as equals + a deliberate choice.** The agent doesn't treat BEM+`@apply` as a "failure
   of utilities"; it picks an approach via the decision tree (repeated markup, third-party DOM, the repository's convention,
   number of states), not by habit, and **states the reason**.
3. **Semantic tokens, not hex.** A repeated value → a `@theme` token with a canonical name;
   a one-off arbitrary value is acceptable sparingly. No scatter of `bg-[#hex]`/`p-[18px]` across the code.
4. **Token-driven dark mode.** The theme lives in token overrides under `.dark` (`@custom-variant`
   + `.dark` overrides), and **not** in a scatter of `dark:` variants on every markup element.
5. **Rejection of dynamic class names.** No gluing `text-${tone}-500` / `'bg-' + color`;
   detection is literal — full class strings or a value→ready-class mapping; `@source inline(...)`
   only as a last resort.
6. **`@apply` grouping + BEM.** In approach B, the declarations are grouped by property-order (layout →
   sizing → spacing → background/borders/shape → typography → effects → interaction), then states,
   then modifiers; each group on a separate line with a comment; `@reference` is present.
   BEM (default; configurable per project — element `-`, modifier `_`): block `cardList`, block modifier
   `cardList_compact`, element `cardList-item`, element modifier `cardList-item_active` (camelCase, no
   `-a-b` chains).
7. **Accessibility + the full set of states.** `hover` / `focus-visible` / `active` / `disabled`;
   visible focus (`outline-ring`/`ring-ring`); contrasting token pairs (`*` + `*-foreground`);
   semantic markup (`<button>`, `<dialog>`, `<label for>`).
8. **No AI-slop.** No purple-blue gradients, glassmorphism, excessive rounding, decorative
   blobs, or random shadows; the example is skeletal and neutral.
9. **Deference to the external design system (§3A).** Ready-made tokens / `DESIGN.md` are **mapped** into
   `@theme` under stable names, not invented and not rewritten. On a conflict, priority goes
   to the design system; the skill insists only on the correctness of Tailwind v4.
10. **Container vs viewport.** Where size depends on the container rather than the window — `@container`
    + `@sm:`/`@md:`, not just viewport breakpoints.
11. **Framework-agnosticism.** The output is plain HTML + CSS/SCSS. No Vue/React/Nuxt/Svelte/JSX/Pinia.
    `cn()`/clsx/tailwind-merge/CVA — only as an explicit optional aside, "if you're in a JS framework".

---

## How to run

1. **Load the skill.** A run is done by an agent that has `skill-tailwind` available and applied to the
   task. Without the skill it's a baseline run for contrast, not for scoring.
2. **Give the case prompt verbatim** from `cases.md` (the "Prompt" column). Don't hint at the answer,
   don't mention v4/tokens/BEM in the prompt itself unless that's part of the case — otherwise you're testing the hint,
   not the skill. Some cases are deliberately neutral ("make it look nice with Tailwind classes"), some come with
   fixture material on input (migration, refactor, review).
3. **Attach the fixture** if the case references it: the contents of `fixtures/` are fed as **input**
   ("here's the current code, …"). The fixtures deliberately contain "bad" v3 code — this is **input for migration**,
   not a reference answer.
4. **Score the output against the case rubric.** Each case in `cases.md` has "What's good" (success signals)
   and "Fail" (anti-signals). Check the anti-signals first: any clear anti-signal = case fail,
   even if something was done well.
5. **Record a score on the scale** (below) and one or two lines of rationale referencing a specific signal.

### Scoring scale (per case)

| Score | Meaning |
| --- | --- |
| **2 — pass** | All key "What's good" signals are present; **not a single** "Fail" anti-signal. |
| **1 — partial** | The core behavior is there, but 1–2 signals are missing OR there's a soft miss (e.g. tokens are present, but one state is missing). No gross anti-signals. |
| **0 — fail** | At least one "Fail" anti-signal is present (e.g. v3 syntax as a recommendation, a dynamic class name, hex instead of a token on an explicit repeat) OR a key behavior is absent. |

The skill is considered to pass the set if **all** cases are ≥ 1 and the share of **2**s is no lower than a
predetermined threshold (recommendation: ≥ 80% of cases at 2). Any single **0** is a regression — investigate it separately.

### What counts as a "diagnostic" case

A case is useful only if the base model **without the skill** tends to err (emit v3, hex, a scatter of
`dark:`, dynamic classes, AI-slop), and **with the skill** does not. If both runs are the same — the case
doesn't diagnose the skill; flag it and revise the prompt (make it more neutral, remove hints).

---

## How to use fixtures

The fixtures in `fixtures/` are **input material** for cases, not reference answers:

| File | What's inside (deliberately "bad") | For which cases |
| --- | --- | --- |
| `fixtures/v3-snippet.css` | v3 CSS: `@tailwind` directives, `@layer utilities { .x {} }`, `important: true`-style | v3→v4 migration, review |
| `fixtures/v3-snippet.html` | v3 markup: `bg-opacity-*`, `bg-gradient-to-*`, `bg-[#hex]`, old `shadow-sm` | v3→v4 migration, review, tokens |
| `fixtures/utility-soup.html` | duplicated "utility soup" + hex throughout the component | refactor into tokens/BEM, approach choice |

Rules for handling fixtures:

- They are fed to the agent as the **current state** ("here's the project code; …"), not as an example of "how it should be".
- The "bad" v3 code in the fixtures is **expected and acceptable**, because it's marked as input. In the
  **main body of the skill** (SKILL.md, references, examples, templates) there must be no such code —
  there, v3 lives only in a before→after pair.
- The same file can feed several cases from different angles (migration / review / refactor).
- When scoring, compare the agent's output not against the fixture but against the **case rubric**: the task is to see that
  the agent turned the "bad" input into correct v4 output along the relevant axis.

---

## Runnable harness (`harness.mjs`)

Before scoring against the rubric with an LLM judge, run the **static harness** — a fast auto-filter
that checks the part of the axes that can be checked without a model. It's a dependency-free Node script
(offline, heuristic):

```
node evals/harness.mjs <file-or-files>
# e.g.: node evals/harness.mjs candidate.html out.css
```

What it checks (by the axes from this README): no v3 patterns (`@tailwind base`, `bg-opacity-*`,
`bg-gradient-to-*`, `bg-[--var]`, `@layer utilities`) — axis 1; no dynamically assembled class names
(`text-${…}`, concatenation) — axis 5; no hardcoded hex in `class=` on a repeat — axis 3; for interactive
markup, `hover`/`focus-visible`/`disabled` are present — axis 7; correct BEM separators — axis 6;
validation via `user-invalid:`, not `invalid:`/`peer-invalid:`; signs of AI-slop (purple→blue gradient,
excessive rounding) — axis 8.

- Prints per-check `PASS`/`FAIL`/`WARN` with the axis number, line, and a fix hint; `exit 1` if
  the counted files failed (handy for CI).
- Files from `fixtures/` are recognized as **INPUT** and shown but **not counted** (they're deliberately
  "bad").
- This is a **pre-filter**, not a replacement for the rubric: the harness catches mechanical anti-signals; the deliberateness of the
  A/B choice, §3A deference, and the quality of explanations are still scored by the judge against `cases.md`.

Reference results of migrating/refactoring the v3 fixtures are in `fixtures/expected-v4.md` (a guide for the judge,
not a strict diff).

### Real compilation (`compile-check.mjs`, optional)

`harness.mjs` is static heuristics (dependency-free). To catch what's only visible from a real
build (an unknown utility, an invalid `@apply`), there's `compile-check.mjs` — it **compiles** the code
with real Tailwind v4: HTML is checked for utility validity, and `.scss`/`.css` is run through Sass and
then through Tailwind (an `@apply` error surfaces as a hard error). Requires installation (NOT offline):

```
npm i -D tailwindcss @tailwindcss/cli sass
node evals/compile-check.mjs [--theme templates/theme.css] examples/button/button.utility.html examples/button/button.bem.scss
```

`--theme` defaults to `templates/theme.css` (the skill's canonical `@theme`); specify your own entry/theme
to check your own code against your tokens. Exit: `0` — all good, `1` — real errors, `2` —
dependencies not installed (skip, not a fail). This is the reference way to "implement an example and check it".

---

## Related

- The list of cases and rubrics — `cases.md`.
- The runnable static harness — `harness.mjs`; references for the fixtures — `fixtures/expected-v4.md`.
- The review checklist (12 items) the rubrics rest on — `../references/review.md`.
- Canonical tokens and `@theme` — `../references/tokens.md`, `../templates/theme.css`.
- The A vs B decision tree and `@apply` grouping — `../references/approaches.md`,
  `../resources/apply-grouping.md`.
