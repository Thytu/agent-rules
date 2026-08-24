# TypeScript profile

This profile applies when the repository root contains `package.json` and `tsconfig.json`.

## Runtime and dependencies

- Exact Node and pnpm versions; `.npmrc` enforces engine strictness.
- Commit `pnpm-lock.yaml`; installs use `--frozen-lockfile`.
- `strict`, `noUncheckedIndexedAccess`, and `erasableSyntaxOnly` are mandatory.
- ESLint owns correctness/house rules. Biome formats only.
- Dependency changes include manifest, lock, first use/removal, audit, and Knip results.

## Gate

`bash scripts/setup-typescript.sh` installs the checksum-pinned Node runtime into `.agent-rules/tools`, activates exact pnpm through that runtime, and performs the frozen install.

`bash scripts/verify-typescript.sh` rejects another Node version and runs formatting, ESLint, typecheck, tests, audit, and unused-dependency analysis through the pinned runtime. It never installs dependencies.

## Boundaries

Parse untrusted data once at the edge. Below the edge, use modeled values rather than repeated `typeof`, generic `instanceof`, or optional-field variant bags. `Array.isArray` is the sanctioned array test.

The selected ESLint policy enforces no deferral comments, no compatibility shims, boundary-shape rules, meaningful tests, citation-free comments, and bounded comment length.

## Tests

Product tests live under `test/` and use `.test.ts` or `.test.tsx`. Blank local secrets before suites, observe behavior rather than wiring, and mock only process boundaries.
