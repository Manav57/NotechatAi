<!-- docs/animations-and-motion.md — conceptual overview of motion (agnostic): principles, built-in animate-*, custom keyframes via --animate-*, enter animations without JS (@starting-style), transition-* and duration/ease tokens, reduced-motion. -->
# Animations and motion (Tailwind v4)

This is a **conceptual** chapter: the mental model of interface motion in Tailwind v4,
framework-agnostically (pure HTML + CSS/SCSS, no JS animation libraries). Which properties to animate
and why, which timings the skill's canon considers "correct", how the built-in `animate-*` are wired,
how to add **your own** keyframes via `--animate-*` tokens (without editing the canonical `templates/theme.css`),
and how to do an enter animation **without JS** via `@starting-style` (the `starting:` variant) + `transition-discrete`.
We do not duplicate reference tables: for the full list of variants and "enter animation without JS classes" go to
`references/gotchas.md` and `references/v4-rules.md` §11, for component motion invariants go to
`references/components.md`; ready-made markup/styles are in `examples/modal/*`, `examples/toast/*`,
`examples/drawer/*`, `examples/popover/*`, `examples/spinner-skeleton/*`. Motion accessibility — the overall
overview is in `docs/accessibility.md` §7; here it is **how it is assembled** within the animations themselves.

> One thesis it all boils down to: **motion is communication, not decoration.** An animation
> explains *where* an element came from and *where* it went; if it communicates nothing, it should not exist.
> From this thesis follow both the choice of properties, the timings, and the mandatory `motion-reduce:`.

---

## 1. Principles: what, how fast, and with which curve to animate

### 1.1. Animate only cheap properties — `transform` and `opacity`

The browser lays out a frame in three stages: **layout** (geometry) → **paint** (pixels) → **composite**
(compositing layers on the GPU). `transform` and `opacity` change at the **last** stage — animating them does not
recompute the geometry of neighbors and does not repaint content, so it runs on the GPU and holds 60fps.

```
transform (translate/scale/rotate) + opacity   → composite-only → cheap, smooth, GPU
width / height / top / left / margin            → layout → jolts the whole page's layout
box-shadow / filter / background-position        → paint → repaint, lags over large areas
```

That is why "slid in from the side" is done via `translate-x-full → translate-x-0` (like a drawer), not via
animating `left`/`right`; "appeared" — via `opacity-0 → opacity-100` and `scale-95 → scale-100`
(like a modal), not via `width`/`height`. This is a cross-cutting skill canon (`references/components.md` §motion,
`docs/accessibility.md` §7): **`transform`/`opacity`, not layout properties.**

> The exception that proves the rule: the expansion of a native `<details>` is animated via `height`/
> `content-visibility` through `::details-content` — there this is the only honest path, and it is documented
> separately in `references/components.md` (accordion) and `docs/variants-and-states.md` §5A.6. For everything
> else — `transform`/`opacity`.

### 1.2. Timing: 150–300ms, and why exactly this range

| Duration | Utility | For what |
|---|---|---|
| ~150ms | `duration-150` | microinteractions: hover/active colors, small icons (chevron rotation) |
| ~200ms | `duration-200` | a panel/popover/toast appearing — noticeable, but not sluggish |
| ~300ms | `duration-300` | large movement: an off-canvas drawer slides across the whole edge |

Below ~100ms — the eye does not have time to read the motion, it reads as a "twitch". Above ~300–400ms
— the interface feels sluggish, the user waits. The canon: **microinteractions 150ms, appearances 200ms,
large movements 300ms** — these are exactly the values used in the examples (buttons `duration-150`, modal/toast/
popover `duration-200`, drawer `duration-300`).

### 1.3. Curve: `ease-out` on enter, and why not `ease-in`

```
ease-out  → fast start, soft braking → the element "flies in and smoothly settles". On ENTER/appearance.
ease-in   → slow start, accelerating toward the end → on enter it feels like it "sticks", then jerks.
ease-in-out → symmetric → for in-place movements (back and forth), not for appearance.
linear    → uniform → only for infinite loops (spinner): a constant rotation speed.
```

On an element's **appearance** we take `ease-out`: it respects attention — the motion is immediately noticeable and then
calms down at once. That is why in all the examples the enter goes with `ease-out` (modal/toast/popover/drawer), while
the infinite rotation of a spinner is `linear` (built into `animate-spin`). The curve tokens live in the
`--ease-*` namespace (`@theme`); more on namespaces — `references/tokens.md` and `docs/design-tokens.md`.

---

## 2. Built-in animations: `animate-spin` / `animate-pulse` / `animate-bounce` / `animate-ping`

Tailwind v4 provides four ready-made infinite animations — the keyframes for them are already built in, you do not need to
declare anything separately:

```
animate-spin    → uniform 360° rotation (linear, infinite) → loading indicator (spinner ring)
animate-pulse   → smooth fade-out/return of opacity → skeleton placeholders "breathe"
animate-bounce  → vertical bouncing → "scroll down" arrow, attracting attention
animate-ping    → expansion + fade (like a radar) → indicator dot "there's something new"
```

The reference is `examples/spinner-skeleton/*`: the ring spins via `animate-spin`, the placeholders pulse
via `animate-pulse`, and **both** are quenched under reduced-motion via `motion-reduce:animate-none` (see §6).

```html
<!-- spinner: ring + one transparent edge, infinite rotation, stop under reduced-motion -->
<span aria-hidden="true"
      class="inline-block size-6 rounded-full border-2 border-border border-t-transparent
             animate-spin motion-reduce:animate-none"></span>

<!-- skeleton: placeholder "breathes", also stops under reduced-motion -->
<span aria-hidden="true" class="h-4 w-2/3 rounded-sm bg-muted animate-pulse motion-reduce:animate-none"></span>
```

```scss
/* B (BEM + @apply): the same animation as a nested declaration (see examples/spinner-skeleton/*.bem.scss) */
.spinner_ring {
  @apply inline-block size-6 rounded-full border-2 border-border border-t-transparent;
  @apply animate-spin motion-reduce:animate-none;
}
```

> `animate-*` are **infinite** loops for indicating state (loading is in progress, there's something new). For
> a **one-time appearance** of an element (a modal/toast/popover slides out once) keyframes are not needed — there
> `transition` + `@starting-style` does the work (§4). Do not confuse the two mechanisms: loop vs one-time enter.

---

## 3. Custom keyframes via the `--animate-*` token in `@theme`

When the four built-ins are not enough (you need your own "reveal", "slide-out", "shake on error"), v4 registers
a custom animation **as a token** in the `--animate-*` namespace, while the `@keyframes` themselves are declared **inside**
`@theme`. After that the name becomes the `animate-<name>` utility — exactly like the built-ins, and available in
both approaches (A — `animate-fade-in` in markup, B — `@apply animate-fade-in`).

> **Important:** `@theme` accepts **only** `--variables` and `@keyframes` — no nested
> selectors/`@media`/`:root` inside (`references/gotchas.md`, `references/v4-rules.md` §2). And `@apply`
> is **forbidden inside `@keyframes`** (`references/gotchas.md`, `references/approaches.md`) — frames are written in
> raw CSS with values (you can reference other tokens via `var(--…)`).

### How to ADD to your own `theme.css`, WITHOUT editing the canonical one

The canonical `templates/theme.css` is the contract reference for semantic tokens; we do not rewrite it.
Your own animations are added **to the project's** `theme.css` next to the rest of the `@theme` tokens. The snippet is a
ready-to-paste block:

```css
/* In your @theme (the same block where --color-*, --radius-*, … live): register the animation tokens. */
@theme {
  /* animation token = name → animate-fade-in / animate-slide-up utility */
  --animate-fade-in: fade-in 200ms ease-out;
  --animate-slide-up: slide-up 300ms ease-out;

  /* keyframes are declared INSIDE @theme; in the frames — raw CSS, WITHOUT @apply */
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(0.5rem); }  /* cheap: transform + opacity */
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

Now `animate-fade-in` / `animate-slide-up` work like any utility:

```html
<!-- A: your own appearance animation — name from the token -->
<div class="animate-fade-in motion-reduce:animate-none">…</div>
```

```scss
/* B: the same via @apply (animate-* goes in the "effects/motion" group) */
.card {
  @apply rounded-lg border border-border bg-card p-6;
  @apply animate-fade-in motion-reduce:animate-none;
}
```

> Animate **only** `transform`/`opacity` in the frames (§1.1) — then the custom animation stays
> GPU-cheap. Reset/override of the namespace — `--animate-*: initial` (full reset) or pointwise
> `--animate-fade-in: initial`; namespace mechanics — `references/tokens.md`, `docs/design-tokens.md`.

---

## 4. Enter animation WITHOUT JS: `starting:` (`@starting-style`) + `transition-discrete`

The main v4 motion trick: an element's appearance is animated **without JS toggle classes** (the `.is-open`
from v3 is an anti-pattern, `references/v4-rules.md` §11). The browser needs a frame **from which** to start
the transition at the moment the element is inserted / `display` changes — this frame is set by CSS `@starting-style`, and in
Tailwind it is expressed by the **`starting:`** variant.

### Three details without which the enter will not fire

```
1. starting:    → the "starting frame" values (@starting-style): where the transition STARTS FROM
                  (opacity-0, scale-95, translate-x-full …).
2. target frame → ordinary utilities or a state variant (open:, [&:popover-open]:): WHERE to arrive.
3. transition-discrete → allows animating DISCRETE properties (display, overlay),
                  otherwise display:none↔block switches instantly and the transition "doesn't get to" play.
```

`transition-discrete` is the utility equivalent of CSS `transition-behavior: allow-discrete`. It is needed
when an element **appears from `display:none`** (native `<dialog>`, `[popover]`): without it the browser does not
animate the `display` change, and the `starting:` frame is not played. That is why in `transition-*` you explicitly
list `display` (and `overlay` for top-layer): `transition-[opacity,transform,display,overlay]`.

### Where this is already done (references)

| Example | What appears | Starting frame (`starting:`) → target |
|---|---|---|
| `examples/modal/*` | native `<dialog>` + `::backdrop` | `starting:open:opacity-0 starting:open:scale-95` → `open:opacity-100 open:scale-100` |
| `examples/drawer/*` | off-canvas `<dialog>` | `starting:open:translate-x-full` → `open:translate-x-0` |
| `examples/popover/*` | native `[popover]` | `starting:[&:popover-open]:opacity-0 …` → `[&:popover-open]:opacity-100 …` |
| `examples/toast/*` | inserted toast | `starting:opacity-0 starting:translate-y-2` → base `opacity-100 translate-y-0` |

```html
<!-- A: modal appearance (from examples/modal/modal.utility.html, abridged) -->
<dialog class="opacity-0 scale-95
               transition-[opacity,transform,display,overlay] duration-200 ease-out
               transition-discrete motion-reduce:transition-none
               open:opacity-100 open:scale-100
               starting:open:opacity-0 starting:open:scale-95">…</dialog>
```

```scss
/* B: the same enter as @starting-style + @apply (see examples/modal/modal.bem.scss) */
.modal {
  @apply opacity-0 scale-95;
  @apply transition-[opacity,transform,display,overlay] duration-200 ease-out
         transition-discrete motion-reduce:transition-none;
  &[open] { @apply opacity-100 scale-100; }                          /* target frame */
  @starting-style { &[open] { @apply opacity-0 scale-95; } }         /* starting frame */
}
```

The A/B difference here is purely syntactic: the `starting:open:` variant in markup (A) ⇄ the
`@starting-style { &[open] { … } }` block in SCSS (B) — the same CSS in the output.

> **When `@starting-style`, and when `animate-*`.** `@starting-style`/`starting:` — for a **one-time
> enter** of an element that has an "open/closed" state (modal, drawer, popover, toast,
> `<details>`). Infinite indication (loading, "there's something new") — that is `animate-*` (§2–§3). The toast from
> `examples/toast/*` combines both: the **enter** via `starting:` + `transition-discrete`, and the **exit** —
> via an ordinary `transition` on `opacity`/`transform` (removing the node on a timer requires a couple of lines of native
> JS — this is honestly flagged in the example itself; it is platform JS, not a framework).

---

## 5. Transition utilities and the `duration` / `ease` tokens

`transition` governs **what changes on an event** (hover, opening, an attribute toggle), in
contrast to `animate-*` (a self-playing loop). The base set:

```
transition-colors        → animate only color/background/border (button hover/active — the most common)
transition-transform     → only transform (chevron rotation, switch thumb shift)
transition-opacity       → only opacity
transition-[a,b,c]       → an explicit list of properties (needed for display/overlay with @starting-style, §4)
transition / transition-all → the default set / everything (transition-all — careful, it jolts extra)
```

```
duration-150 / -200 / -300   → duration (§1.2)
ease-out / ease-in / ease-in-out / ease-linear   → curve (§1.3); custom ones — the --ease-* token in @theme
delay-*                       → start delay (for example, list stagger)
```

```html
<!-- A: microinteraction — only color, 150ms, stop under reduced-motion -->
<button class="bg-primary text-primary-foreground
               transition-colors duration-150 ease-out motion-reduce:transition-none
               hover:bg-primary/90 active:bg-primary/95">Save</button>

<!-- A: icon rotation based on ancestor state — only transform -->
<svg class="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none
            group-aria-expanded:rotate-180">…</svg>
```

```scss
/* B: the same set; transition-* and duration/ease — in the "effects/motion" group, states — after */
.button {
  @apply bg-primary text-primary-foreground;
  @apply transition-colors duration-150 ease-out motion-reduce:transition-none;
  &:hover  { @apply bg-primary/90; }
  &:active { @apply bg-primary/95; }
}
```

> `@apply` grouping: `transition-*` / `duration-*` / `ease-*` / `animate-*` go in **"effects/motion"**
> — after background/borders/typography and **before** interaction; states (`&:hover`, `&[open]`) — even
> later, then modifiers. The full order — `references/approaches.md`, `resources/apply-grouping.md`.
> A custom curve token is registered as `--ease-snappy: cubic-bezier(…)` in `@theme` and yields the
> `ease-snappy` utility (mechanics — §3 and `references/tokens.md`).

---

## 6. Motion accessibility: `motion-reduce:` / `motion-safe:` — MANDATORY

This is not an option but a **contract**: for some users sharp motion (especially large movements,
parallax, infinite loops) causes vestibular discomfort up to nausea. The system setting
`prefers-reduced-motion` communicates this, and the interface **must** respect it. Two variants — two sides
of the same coin:

```
motion-reduce:  → @media (prefers-reduced-motion: reduce)  → the user ASKS for less motion
motion-safe:    → @media (prefers-reduced-motion: no-preference) → motion is ALLOWED by the system
```

Two equally valid approaches to one result:

```
A) Base with motion + quenching:  transition-… duration-… motion-reduce:transition-none
   (animation by default; under reduced-motion it is disabled — the most common pattern in the skill)
B) Base without motion + enabling: motion-safe:transition-… motion-safe:duration-…
   (static by default; motion is added ONLY when the system has allowed it)
```

Approach **A** (quench via `motion-reduce:`) is the canon of the skill's examples, because motion remains
the default for the majority and is disabled in a targeted way. Approach **B** (`motion-safe:`) is appropriate when motion
is especially aggressive and it is safer to keep it **opt-in**. Both are correct; choose by the "cost" of the animation.

```html
<!-- A: quench the transition and animation under reduced-motion (the pattern of all examples) -->
<dialog class="… transition-[opacity,transform,display,overlay] duration-200 ease-out
               transition-discrete motion-reduce:transition-none …">…</dialog>
<span class="… animate-spin motion-reduce:animate-none"></span>

<!-- B: motion only when the system has allowed it (opt-in for "expensive" animation) -->
<div class="motion-safe:animate-slide-up">…</div>
```

> What exactly to quench: for `transition` — `motion-reduce:transition-none`; for `animate-*` —
> `motion-reduce:animate-none`. The spinner, meanwhile, **keeps** its role: a ring without rotation still
> reads as "loading" thanks to `role="status"` + an `sr-only` label (`examples/spinner-skeleton/*`).
> The goal of reduced-motion is to remove **motion**, not to remove **meaning**: the final state and the accessible
> semantics are preserved. The overall a11y context of motion — `docs/accessibility.md` §7.

---

## Checklist (quick motion self-check)

- [ ] Animate only `transform`/`opacity` (composite/GPU), and NOT `width`/`top`/`box-shadow` (layout/paint) — §1.1.
- [ ] Timing in the 150–300ms range: micro `duration-150`, appearance `duration-200`, large movement `duration-300` — §1.2.
- [ ] Curve on enter — `ease-out`; infinite loop (spinner) — `linear` — §1.3.
- [ ] Infinite indication — the built-in `animate-spin`/`animate-pulse`/`animate-bounce`/`animate-ping` — §2.
- [ ] Custom animation — the `--animate-*` token + `@keyframes` INSIDE `@theme` (in the project theme.css, WITHOUT `@apply` in the frames) — §3.
- [ ] One-time enter — `starting:` (`@starting-style`) + target frame; for `display:none` elements also `transition-discrete` (allow-discrete) — §4.
- [ ] The enter is not faked with the `.is-open` JS class (a v3 anti-pattern) — it is `starting:` without a JS toggle — §4.
- [ ] `transition-*` in the `@apply` "effects/motion" group (before interaction), states — after — §5.
- [ ] reduced-motion is respected ALWAYS: `motion-reduce:transition-none` and/or `motion-reduce:animate-none` (or opt-in via `motion-safe:`) — §6.
- [ ] Under reduced-motion the motion disappears, but NOT the meaning: the final state and the accessible semantics (spinner `role="status"`) are preserved — §6.
