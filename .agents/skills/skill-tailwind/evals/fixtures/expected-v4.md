# Reference v4 results for fixtures (judge's benchmark)

This is a **reference for evaluation**, not a strict diff: the task has no single correct answer (token names,
A vs B choice, degree of decomposition may differ). The judge checks the agent's output against the case rubric in
`../cases.md` and against these benchmarks. The canonical tokens are placeholders; the names are stable.

Mapping of fixtures to cases: `v3-snippet.css`/`v3-snippet.html` → EV-01 (migration), EV-03 (tokens),
EV-11 (review); `utility-soup.html` → EV-10 (refactor), EV-11 (review).

---

## 1. `v3-snippet.css` → v4 (migration)

What must happen (anti-signal if it does not):

- `@tailwind base/components/utilities;` → **`@import "tailwindcss";`**
- `@layer utilities { .content-auto { … } }` → **`@utility content-auto { content-visibility: auto; }`**
- the repeated brand hex `#1f6feb` and `#ffffff` → **semantic `@theme` tokens** (`--color-primary`,
  `--color-primary-foreground`), and `rgba(31,111,235,.9)` on `:hover` → slash opacity `bg-primary/90`.
- `.card-shadow`/`.btn-primary` are "hidden utility soup" in CSS; in v4 either tokens + utilities in the markup
  (A), or a deliberate component class with grouped `@apply` (B). Both options are acceptable.

Reference (CSS-first config + one of the approaches):

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(52% 0.12 255);          /* was #1f6feb (placeholder) */
  --color-primary-foreground: oklch(99% 0 0);    /* was #ffffff */
  --radius-md: 0.5rem;                            /* was border-radius: 8px */
}

@utility content-auto {                           /* was @layer utilities { .content-auto } */
  content-visibility: auto;
}
```

Approach B (if a component class is chosen — a correct replacement for `.btn-primary`):

```scss
@reference "tailwindcss";

.button {
  @apply inline-flex items-center justify-center;
  @apply h-10;
  @apply px-4;
  @apply rounded-md bg-primary;
  @apply text-sm font-medium text-primary-foreground;
  @apply transition-colors;

  &:hover         { @apply bg-primary/90; }       /* was rgba(…,.9) */
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:disabled      { @apply opacity-50 pointer-events-none; }
}
```

---

## 2. `v3-snippet.html` → v4 (migration + tokens)

Required transformations:

- `bg-gradient-to-r from-purple-500 to-blue-500` → do not reproduce as decoration (this is AI-slop); if a gradient
  is genuinely needed — `bg-linear-to-r` from design system tokens. By default — a neutral surface
  `bg-background`/`bg-card`.
- `bg-white bg-opacity-60 backdrop-blur-md` (glass) → remove glassmorphism; `bg-card text-card-foreground`.
- `bg-opacity-90` → slash `bg-primary/90`. `bg-[#1f6feb]`/`text-[#1f6feb]` → `bg-primary`/`text-primary`.
- `text-[#111827]`/`text-[#6b7280]` → `text-foreground`/`text-muted-foreground`.
- `border-gray-200` → `border-border`; `rounded-3xl`/`rounded-2xl` → the scale `rounded-lg`.
- `shadow-sm` (old value) → if needed `shadow-sm` is already shifted (the former `shadow`); remove the shadow
  if it is not from the design system.
- The button/link gains **states** `hover` + **`focus-visible:outline-ring`** (it had only hover).

Reference (approach A, neutral, no slop):

```html
<section class="rounded-lg bg-card text-card-foreground p-8">
  <div class="p-6">
    <h2 class="text-2xl font-bold text-foreground">Hero</h2>
    <p class="mt-2 text-sm text-muted-foreground">Subtitle placeholder.</p>

    <div class="mt-4 flex items-center gap-2">
      <button type="button"
        class="inline-flex items-center h-10 px-4 rounded-md
               bg-primary text-primary-foreground text-sm font-medium
               transition-colors hover:bg-primary/90
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
               active:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none">
        Action
      </button>
      <a href="#"
        class="inline-flex items-center h-10 px-4 rounded-md
               border border-border text-foreground text-sm font-medium
               transition-colors hover:bg-muted
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Secondary
      </a>
    </div>
  </div>
</section>
```

---

## 3. `utility-soup.html` → v4 (refactor)

The smell — the same "wall" of classes with arbitrary-hex, copied three times. The correct response is
**to extract the repeated MARKUP** (step 2 of the ladder: partial/loop/fragment), and to promote the repeated
**values** into `@theme` tokens; arbitrary `bg-[#fff]`/`rounded-[10px]`/`shadow-[…]` → tokens.
If the markup cannot be extracted (third-party/CMS DOM) — a deliberate component class (approach B, BEM+`@apply`).

What should appear (anti-signal if a triple copy with hex remains):

- `bg-[#ffffff]` → `bg-card`; `border-[#e5e7eb]` → `border-border`; `text-[#111827]` → `text-card-foreground`/
  `text-foreground`; `text-[#6b7280]` → `text-muted-foreground`; `bg-[#eef2ff] text-[#1f6feb]` → `bg-muted`/
  `bg-primary/10 text-primary`.
- `rounded-[10px]` → `rounded-lg`; `shadow-[0_2px_8px_…]` → a shadow token / `shadow-sm`.
- `rounded-full` on an avatar — **acceptable** (this is its legitimate niche: avatar/pill).
- The card exists in **one** place (an extracted block/iteration), not copied N times.

Reference — approach B (one component class instead of the triple wall):

```scss
@reference "tailwindcss";

.mediaItem {
  @apply flex items-start gap-3;
  @apply w-full;
  @apply p-4;
  @apply rounded-lg border border-border bg-card shadow-sm;
  @apply text-card-foreground;

  &_avatar { @apply shrink-0 flex items-center justify-center size-9 rounded-full bg-muted text-primary; }
  &_title  { @apply text-sm font-medium text-foreground; }
  &_desc   { @apply text-xs text-muted-foreground; }
}
```

```html
<ul class="space-y-3">
  <li class="mediaItem"><span class="mediaItem_avatar">A</span>
    <div><p class="mediaItem_title">Item one</p><p class="mediaItem_desc">Description placeholder.</p></div>
  </li>
  <!-- the remaining items — the same classes; in a real project this is a loop/partial, not copy-paste -->
</ul>
```

Approach A is equivalent in result: the same token-utilities, but the repetition is removed **by extracting the markup into
an iteration/partial**, not by collecting utilities into a class. Both options count — what matters is that the
duplication and arbitrary-hex are gone.
