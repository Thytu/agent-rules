# Next.js

## Review scope

Apply this owner to App Router routes, layouts, server and client components, route handlers, server actions, caching, metadata, and the client bundle. React component rules stay with `docs/rules/react.md`. For framework APIs, read the documentation that ships with the installed version in `node_modules/next/dist/docs/`; it matches the code this repository runs.

## Requirements

Components are server components unless they need state, effects, event handlers, or browser APIs. Put `"use client"` at the smallest leaf that needs it, and pass server data down as props. Code that holds secrets, database access, or provider credentials imports `server-only`. Only values meant for every visitor use the `NEXT_PUBLIC_` prefix.

Route handlers and server actions are public endpoints: they parse their input with a schema, authorize the caller for the specific resource, and return explicit error responses. Redirects and links use typed routes.

Caching is a decision, not a default left in place. Every fetch or data read in a route states whether it is static, revalidated on an interval, or dynamic, and data that differs per user is never cached across users.

Every route has `loading`, `error`, and `not-found` handling where the user can reach that state. Metadata names each page.

The client bundle has budgets in `bundle-budgets.json`, enforced in CI. When a route or package exceeds its budget, reduce what ships to the browser first: a narrower import, server-only placement, a dynamic import for rarely used UI, or a lighter dependency. Raise a budget only with the measurement and the reason in the pull request.
