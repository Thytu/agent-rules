# Tailwind CSS

## Review scope

Apply this owner when adding or changing Tailwind classes, design tokens in `src/styles/globals.css`, or component styling. `tooling/eslint-config/tailwind.mjs` enforces the mechanical rules; this document owns the judgment the linter cannot make.

## Requirements

Style components with Tailwind utilities in their markup. Shared design tokens live in `src/styles/globals.css` under `@theme`, together with document-wide styles and resets; components do not ship their own stylesheets.

Class names are complete and statically detectable. For variants, select from maps of complete class strings; never build a utility name from fragments or runtime data. Name class-string constants with a `Class` or `Classes` suffix so the linter checks them.

A value that recurs, or that carries meaning (a brand color, a type size, a radius, an elevation), is a named theme token. One-off layout geometry may stay local. Arbitrary values for typography, radii, shadows, and raw colors are rejected by lint; add a token instead.

Keep styling owned by the component or its shared UI primitive. Add a custom `@utility` or a global selector only for behavior that is truly reusable or applies to the whole document. Extract a component when it gives repeated UI a name or behavior; a long class list alone is not a reason for an abstraction.

Static checks cannot judge visual quality. For every UI change, run the app and inspect the rendered result at desktop and mobile widths, including hover, focus, and dark or reduced-motion states the change affects.
