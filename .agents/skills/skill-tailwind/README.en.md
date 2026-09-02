# skill-tailwind

> AI-**skill** for writing, configuring, migrating, and reviewing modern **Tailwind CSS v4**
> (CSS-first) — framework-agnostic (plain HTML + CSS/SCSS), teaching **two equal** ways to organize
> styles: utility-first and BEM + `@apply`.

[Русский](README.md) · **English** · License: MIT · Tailwind CSS v4

`SKILL.md` is the agent's entry point; the depth lives in `docs/`, `references/`, `resources/`, with
ready-made code in `examples/` and `templates/`.

## What it is

skill-tailwind is the **implementation layer** for Tailwind v4: how to express a style correctly with
v4's means, in any stack or none. It helps when you:

- migrate from Tailwind v3 to v4 and stumble over the new CSS-first config;
- set up semantic design tokens and dark mode on CSS variables;
- weigh "utilities in markup vs. `@apply` in CSS" and want a reasoned framework, not dogma;
- review Tailwind code and want a checklist plus the subtle v4 gotchas.

It is an **implementation layer, not a design one** — it wires Tailwind correctly but does not pick a
visual direction. Token *values* are replaceable placeholders; only token **names** are stable.

## Installation (for AI agents)

This repository **is** the skill: `SKILL.md` sits at the repo root, alongside its supporting `docs/`,
`references/`, `examples/`, `templates/`, `resources/`, `workflows/`, `scripts/`, `evals/`. Install it
wherever your agent reads skills.

### Claude Code

Personal (available in every project):

```bash
git clone https://github.com/rekryt/skill-tailwind.git ~/.claude/skills/skill-tailwind
```

Project-only (run from the project root):

```bash
git clone https://github.com/rekryt/skill-tailwind.git .claude/skills/skill-tailwind
```

The skill lands at `…/skills/skill-tailwind/SKILL.md` and is **auto-discovered** — it loads
automatically when you work on Tailwind, or you can invoke it explicitly with `/skill-tailwind`.
Update later with `git -C ~/.claude/skills/skill-tailwind pull`.

### Claude.ai (web) & Claude Desktop

1. Package the skill as a ZIP with the **folder at the archive root**:

   ```bash
   git clone https://github.com/rekryt/skill-tailwind.git
   zip -r skill-tailwind.zip skill-tailwind
   ```

2. In Claude, open **Settings → Capabilities → Skills** (code execution must be enabled), choose
   **Create skill → Upload a skill**, and upload `skill-tailwind.zip`.
3. It loads automatically on relevant requests, or via `/skill-tailwind`. Uploaded skills are private
   to your account; on Team/Enterprise plans an admin can share them.

### Claude Agent SDK / Messages API

Skills are uploaded to your workspace, then attached to a request's execution container (requires the
Skills + code-execution betas). Python example:

```python
from anthropic import Anthropic
from anthropic.lib import files_from_dir

client = Anthropic()  # reads ANTHROPIC_API_KEY

skill = client.beta.skills.create(
    display_title="Tailwind CSS v4",
    files=files_from_dir("./skill-tailwind"),   # folder containing SKILL.md
)

resp = client.beta.messages.create(
    model="claude-opus-4-8",
    max_tokens=2048,
    betas=["skills-2025-10-02", "code-execution-2025-08-25", "files-api-2025-04-14"],
    container={"skills": [{"type": "custom", "skill_id": skill.id, "version": "latest"}]},
    tools=[{"type": "code_execution_20250825", "name": "code_execution"}],
    messages=[{"role": "user", "content": "Set up Tailwind v4 design tokens with @theme and dark mode."}],
)
```

API/SDK skills are **workspace-scoped** (separate from Claude Code and claude.ai); up to 8 skills per
request. See the Agent Skills docs for current details, as the beta identifiers may change.

### Any other agent / framework

A skill is just `SKILL.md` + bundled references using **progressive disclosure**. Copy this folder into
your agent's skills path (or point the agent at `SKILL.md`): it reads `SKILL.md` first and pulls files
from `references/`, `docs/`, `examples/`, `templates/`, etc. on demand. The `description` in the
`SKILL.md` frontmatter is what makes an agent decide to consult the skill.

## What it covers

- **Tailwind v4 only (CSS-first):** `@import "tailwindcss"`, config via `@theme`, custom utilities via
  `@utility`, variants via `@custom-variant`/`@variant`. v3 syntax appears only as "before → after".
- **Two equal approaches, paired examples:** **(A) utility-first** (classes in the markup) and
  **(B) BEM + `@apply`** in SCSS, declarations grouped by property type — plus *when* to pick which.
- **Design tokens via `@theme`:** semantic names, dark mode on CSS variables, mapping an external
  design system instead of redefining it.
- **More:** v3 → v4 migration; build integration (`@tailwindcss/postcss` vs `@tailwindcss/vite`,
  `@reference` in component styles); responsive `@variant`; states & accessibility; a review checklist,
  decision trees, and an anti-pattern gallery.
- **Grounded in sources, not marketing:** behavior checked against the engine sources and official docs.

## What it does NOT include

- **Framework-specific code** (React / Vue / Nuxt / Svelte) — examples are plain HTML + CSS/SCSS; JS
  glue (`cn()` / clsx / tailwind-merge) is mentioned only as an optional aside.
- **Stateful-JS component behavior** — combobox, command palette, date-picker, sortable data-table,
  carousel, charts, focus-trap, etc. The skill styles the markup; prefer the native element, otherwise
  it's a JS layer that Tailwind still styles.
- **Visual/design decisions** — it doesn't pick a palette, typography, or "direction". A ready-made
  design system is **mapped** into `@theme` (names stable, values replaceable), not invented.

## BEM convention

For approach B (BEM + `@apply`): multi-word parts are `camelCase` (lowercase-first). Element separator
`-`, modifier separator `_`:

```
cardList                 // block
cardList_compact         // block modifier
cardList-item            // element
cardList-item_active     // element modifier
cardList_size_lg         // key-value modifier
```

One block per component; elements always derive from the block (no `-a-b` chains). This is the
**default and is configurable** — if a project already declares another scheme, follow it.

## Repository structure

| Path | Purpose |
| --- | --- |
| `SKILL.md` | the entry point: when to apply, the core of the approach, and routing to everything else |
| `README.md` / `README.en.md` | human-readable description (RU / EN) |
| `docs/` | conceptual explanations by topic (in depth), incl. v4.1 features (`text-shadow-*`/`mask-*`, …) |
| `references/` | dense references for progressive disclosure, loaded on demand |
| `examples/` | 27 components, each in both variants (A — utility-first, B — BEM + `@apply`) |
| `templates/` | starters: entry CSS, `@theme` tokens, component skeletons |
| `resources/` | flat scannable cheat sheets + aggregators (decision trees, anti-patterns, master checklist) |
| `workflows/` | step-by-step playbooks: v3 → v4 migration, refactor to tokens, review, choosing A/B, troubleshooting |
| `scripts/` | optional offline checks (no network): v3 anti-patterns, dynamic class names |
| `evals/` | behavioral quality checks for the skill: cases, fixtures, and a runnable static harness |

## Quick start

Wiring v4 is one line instead of v3's three directives, and config lives in CSS via `@theme` (names are
stable; replace the values to fit your design system):

```css
@import "tailwindcss";

@theme {
  /* values are placeholders; names stay stable */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);
  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);
  --radius-md: 0.375rem;
}
```

Declared tokens immediately become utilities — `bg-background`, `text-foreground`,
`bg-primary text-primary-foreground`, `rounded-md`; opacity is the slash modifier (`bg-primary/90`). A
full starter with semantic tokens and dark mode is in `templates/theme.css`. Then open `SKILL.md` — it
routes you to the right section for your task.

## License

[MIT](LICENSE) © 2026 rekryt.

Repository: <https://github.com/rekryt/skill-tailwind>
