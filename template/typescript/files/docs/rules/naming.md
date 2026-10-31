# Naming

## Review scope

Apply this owner when naming JavaScript or TypeScript declarations, files, or internal properties. The `@typescript-eslint/naming-convention` rule in `eslint.config.mjs` checks declarations; this document owns what the rule cannot see.

## Requirements

Use `camelCase` for variables, parameters, functions, hooks, and internal properties: `sessionId`, `readSession`, `useSessionStatus`. Use `PascalCase` for components, classes, and constructor-valued bindings, and for interfaces, type aliases, enums, and type parameters: `SessionList`, `SessionSummary`, `TSession`. Do not prefix interfaces with `I`. Use `UPPER_CASE` only for fixed module constants such as `MAX_BATCH_SIZE`; an ordinary `const` stays `camelCase`. One leading underscore marks an intentionally unused binding. HTTP handler exports keep their required names, such as `GET` and `POST`.

Name a thing for what it means to the product, not for its type or its implementation: `overdueInvoices`, not `filteredList`. Booleans read as facts: `isArchived`, `hasAccess`. Use one word per concept across the codebase.

Filenames are descriptive `kebab-case`: `read-session.ts`, `session-list.tsx`. Framework and tool filenames keep their required spelling, such as `page.tsx` and `eslint.config.mjs`.

External names keep their contract: API fields, database columns, environment variables, and serialized keys are spelled as the other side defines them. Alias them at the boundary instead: `const { session_id: sessionId } = payload`.
