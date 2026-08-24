# Engineering conventions

## Boundaries and types

Settle external shape once at the edge. Everything below receives a modeled value. Program-produced variants use enums/discriminated unions, overloads, or narrower parameters rather than optional-field bags and repeated runtime probing.

Failures remain failures until a boundary deliberately presents them. Never discard errors, turn them into empty success, or retry work that is not proven idempotent. Errors carry operation context without leaking secrets.

## Application boundaries

Every independently callable read or mutation authenticates and authorizes itself; parent layouts, middleware, and client state are not security boundaries. Ownership and tenant identifiers come from the authenticated server context, never from client payloads. Every persistence operation is explicitly scoped to that owner or tenant.

Mutating controls prevent duplicate submission for user experience, and genuinely duplicating operations are idempotent at the server boundary. External creates and deletes use stable keys.

Queries select only fields their projection needs. User-growing collections are capped or paginated with an honest truncation signal or total; no list silently clips results.

## Lifecycle and bounded work

Every background task, subprocess, stream, subscription, and external resource has an owner, cancellation path, and observed terminal result. Desired and observed external state are separate; recovery reconciles provider truth. Creates and deletes use stable idempotency keys.

Queues, retained history, uploads, retries, and concurrency are bounded with explicit capacity behavior. External calls have timeouts and explicit failure outcomes.

## No deferred or parallel implementations

Do not leave TODO implementations, silent fallbacks, compatibility shims, deprecated aliases, parallel V2 paths, or code comments promising later cleanup. A scope cut is recorded in `SCOPE.md`, and the unavailable path fails explicitly.

Change a contract by migrating every caller and deleting the old path in the same change. Compatibility at an uncontrolled external boundary requires an owner-approved specification.

## Cost model

Do not allocate, copy, serialize, fetch, parse, or recompute invariant data in repeated paths when ownership or initialization can do it once. Reuse compiled patterns, provider clients, parsed configuration, and invariant paths. Add caches only after measurement and with explicit invalidation.

## Tests

A test pins an observable contract the code could plausibly violate. Expected values come from the scenario, boundary, bug, or specification—never from re-reading the implementation. Tests are deterministic, parallel-safe, isolate local resources, and leave no process, file, socket, or external state behind.

Mock only process boundaries. Assertions observe behavior; mock-call assertions may corroborate but never stand alone. No pass-through tautologies, snapshot-as-coverage, copied prompt literals, or assertions of type-system guarantees.

Tests live under `test/` or the owning language's conventional integration-test directory, named for the tested surface. Language-specific enforcement lives in the selected profile.

## Comments

Default to no comment. Keep only a non-obvious reason or invariant whose removal would cause misunderstanding. Never narrate the change, cite planning artifacts, restate syntax, or write multi-paragraph implementation essays.
