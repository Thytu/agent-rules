# Authorization and persistence

## Review scope

Apply this owner to changed production code that directly selects application rows, chooses an owner or tenant, mutates persistent application data, or performs an external create or delete that the repository proves can duplicate. An exported endpoint or service that accepts an untrusted request or raw identity is independently callable unless the repository proves a narrower trusted boundary. A service receiving a typed, server-issued authenticated request context may rely on that authenticated identity, but must still authorize and tenant-scope its operation. Tests, type declarations, pure transformations, configuration checks, provider calls of unknown effect, and provider-client construction are outside this owner. A function that only executes already-prepared opaque write operations cannot choose authorization scope and is outside this owner. Do not infer an authorization defect from an identifier-shaped parameter or from lifecycle, failure-handling, or resource-ownership concerns assigned to other owners.

## Requirements

Every independently callable persistent read or mutation authenticates and authorizes itself. Parent layouts, middleware, and client state are not security boundaries. Ownership and tenant identifiers come from authenticated server context, never client payloads, and every persistence operation is scoped to that owner or tenant.

Mutating controls prevent accidental duplicate submission for user experience. Operations that can genuinely duplicate are idempotent at the server boundary; external creates and deletes use stable keys.

Queries select only fields their projection needs. User-growing collections are capped or paginated with an honest truncation signal or total; no list silently clips results. Single-record lookups, statically bounded collections, and queries that already expose their bound are not pagination findings.
