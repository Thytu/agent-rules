# Design system

Locked skin. Implementation = tokens + primitives. Routes never make a visual decision — see [`engineering.md`](engineering.md).

## The one law

Pick the accent's jobs and write them here. A use outside that list is a design regression.

`REPLACE_ME` — name the jobs (wayfinding, selection, focus, prose links, brand, …). The accent never fills a large surface and never paints data.

## Tokens

Live in one file (`REPLACE_ME`). All chrome colors resolve via a single document signal (`color-scheme` / `light-dark()`). Components **never write `dark:` variants**. Theme is a cookie or equivalent the root loader reads so SSR carries the right scheme.

## Type & grid

`REPLACE_ME` — families, sizes, weights, spacing steps. No weight changes between states (layout shift). Fonts are self-hosted. No font CDN.

## States

- **Focus:** a visible ring on every interactive primitive that passes 3:1 in both themes.
- **Hover/press:** background/color/scale feedback only, under 300ms; press uses `scale(0.97)` and is `motion-reduce` exempt.
- **Disabled:** a token, never an opacity.
- **Empty states** say why and what to do next. **Loading** holds the page shape, never a spinner for lists.

## Primitive inventory

Name the primitives here once they exist. They expose typed variants, **never a `className` prop**. Spacing between siblings is the parent's `gap`, never a primitive's margin.

## Motion law

Ease-out for enter/exit (never ease-in). UI under 300ms. Never animate keyboard-initiated actions. `prefers-reduced-motion` respected. Navigation, validation, loading truth, direct manipulation, data updates, and unmount/close remain immediate.
