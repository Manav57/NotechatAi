# Decision trees — quick view

All key forks of the skill in one place: scannable ASCII trees, one per question. This is an
aggregator-index — the trees are synced with the prose in `SKILL.md`, `references/approaches.md`, and
`references/tokens.md`; here they are gathered together for a quick choice, while the "why" and worked examples
live in the source files (link under each tree). On conflict, the source file wins.

Invariant across all trees: **A (utility-first) and B (BEM+`@apply`) are equally useful** — the choice is dictated by
context (repeated markup, third-party DOM, team convention), not by a value hierarchy.

---

## 1. Approach A (utility-first) vs B (BEM+`@apply`) for this component

```
Start: writing / refactoring a component
│
├─ Is the markup third-party / generated (CMS, third-party widget, DOM rewritten by a script)?
│     └─ YES → need a real CSS class matching the render selector → B (BEM+@apply as adapter). [step 6]
│
├─ Is one of the conventions already adopted in the repo (team standard)?
│     └─ YES → follow the adopted one. Consistency beats personal taste.
│
├─ Is this a REPEATED, named primitive (reused 2+ times: button/card/badge/field…)?
│     └─ NO (one-off: page layout, a hero, a section grid, a spec list) → keep utilities in the markup,
│        regardless of A/B convention. Even a "B-everywhere" project leaves non-reused page layout in
│        markup utilities (rung 1); a one-off block with 20+ single-use elements is utility-soup relocated to SCSS.
│
├─ Is the markup repeated?
│     ├─ NO → A (utilities in markup). [steps 1–3]
│     └─ YES → can you extract the MARKUP into a reusable fragment (partial/include/component)? [step 2]
│            ├─ YES → extract the markup; styles inside — A (utility-first). The duplication is gone without a CSS abstraction.
│            └─ NO (no partial mechanism, fragment can't be isolated) → B as the single source of style. [steps 5–6]
│
└─ Many intent variants + states, and "readability at a glance" matters?
      ├─ moderate → A with variants (hover:/focus-visible:/active:/disabled:) handles it.
      └─ many → B: base is neutral (layout/spacing/shared), color/intent/states go in modifiers.
```

More: `references/approaches.md` (§5 — tree + guiding questions; §1 — abstraction ladder; SKILL.md "Decision trees" #1).

---

## 2. Where should a color / token live

```
A color/radius/spacing value — where to put it?
│
├─ One-off, occurs exactly once, with NO meaning beyond the node?
│     └─ YES → arbitrary, sparingly: bg-[oklch(…)], top-[3px], w-[37rem].
│             Write a CSS variable as bg-(--brand), NOT bg-[--brand].
│
├─ Does it have semantics/a role (primary, muted, danger, border, control radius…)?
│     └─ YES → semantic token in @theme (--color-primary, --radius-md…) → utility by name. This is the norm.
│
├─ Is the color carrying STATE feedback, or just CATEGORY / decoration?
│     ├─ STATE (success / warning / danger / info — validation, alerts, status) → a STATUS token.
│     │     Reserve success/warning/danger/info for product STATE; one meaning = one token everywhere.
│     └─ CATEGORY / decoration (tiers, tags, brands, "tones") → --color-accent or a dedicated
│           --color-tier-* / --color-category-* token. NOT a status token: an Admin/Elite tier is not
│           "danger"/"warning". Repurposing status tokens for decoration overloads their meaning and drifts.
│
├─ Does the value come from an external design system / DESIGN.md / ready-made tokens?
│     └─ YES → MAP it into @theme: --color-x: var(--ds-x). DON'T override, DON'T hardcode.
│             "skill vs design system" conflict → the design system wins.
│
└─ Otherwise → arbitrary-first, promote to a token at the FIRST repeat / emergence of meaning (see tree 3).
```

Levels: the markup references **only semantics** (`bg-primary`, not `bg-brand-blue-600` and not `bg-[oklch(…)]`).

More: `references/tokens.md` (§2 brand→semantic→component; §5 mapping an external system; §6 promotion) and SKILL.md "Decision trees" #2.

---

## 3. Arbitrary value vs token (promotion)

```
Need a non-standard value — keep it arbitrary or create a token?
│
├─ One-off exception: unique geometry of a single node, no reuse?
│     └─ YES → KEEP arbitrary: top-[3px], w-[37rem], bg-[oklch(58%_0.18_27)]. More honest than a "just in case" token.
│
└─ Did AT LEAST one promotion signal fire?
      ├─ (a) the literal is duplicated (≥2–3 times);
      ├─ (b) a ROLE/name has formed behind the value ("danger color", "control radius", "card border");
      ├─ (c) it's going to be changed centrally during a redesign / theme switch;
      └─ YES (any) → PROMOTE: create a name in @theme and replace the arbitrary value with a semantic utility.
```

Form reminder: slash modifier (`bg-primary/90`) instead of a `--color-primary-90` token; a named alpha scale
(`color-mix`) — only when specific steps are reused and need their own name.

More: `references/tokens.md` §6 (promotion heuristic) and §4.1 (alpha scale).

---

## 4. Which component to take / native element vs JS

First pick the pattern skeleton, then check the "platform vs JS" boundary. **All 26 skeletons — `references/components.md`**;
full A+B implementations — `examples/`.

```
What am I building?
│
├─ Action/trigger ............. button (<button type="button">) ─ adjacent: badge, toast, spinner-skeleton, avatar
├─ Surface/content ........... card · alert · list · media
├─ Data input ................ input-field · textarea · select · checkbox/radio/switch
│        states: hover/focus-visible/active/disabled; validation — user-invalid: (NOT invalid:/peer-invalid:)
├─ Navigation ................ navbar · breadcrumb · pagination · tabs
├─ Layout .................... responsive-grid (@container + @sm:/@md:) · table
├─ Disclosure/overlay ........ accordion · modal · drawer · tooltip · popover · dropdown · progress
│        native base: <details>/<summary> · <dialog>+showModal() · Popover API (popovertarget)
│
└─ Do you need behavior the platform doesn't have?
      ├─ NO → the native element covers open/close, focus trap, keyboard, Esc — WITHOUT JS. This is the skill's default.
      └─ YES (stateful logic) → give correct semantics/skeleton and HONESTLY mark the boundary; the JS layer is OUTSIDE the skill.
              typical boundaries (don't imitate with a framework):
              · tabs — strict WAI-ARIA: roving tabindex + Arrow/Home/End
              · dropdown/popover — role="menu" + menu keyboard; aria-expanded sync
              · table — sort/filter on click
              · progress/toast — live value update / display timeout
```

Selection rules: real semantics (`<button>`/`<a>`/`<input>`/`<dialog>`, not `role` on a `<div>`); the full
set of states + visible `focus-visible` (`outline-ring`); an `inert:` variant does NOT exist — use the native
`inert` attribute + visual `opacity-50`. A "CVA-like" variant strategy without JS — via `data-*` (see `references/components.md`, last section).

More: `references/components.md` (inventory + cross-cutting rules + honest ARIA boundaries); `examples/README.md` (A/B implementations).

---

## See also

- `SKILL.md` — the "Decision trees" section (brief #1–2) and "Abstraction ladder".
- `references/approaches.md` — §1 ladder, §4 good/bad `@apply`, §5 A vs B tree.
- `references/tokens.md` — §2 hierarchy, §5 external design system, §6 promotion.
- `references/components.md` — 26 skeletons, states, accessibility, "native vs JS" boundaries.
- `workflows/choose-approach.md` — step-by-step playbook for choosing A vs B.
