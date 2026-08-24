# Authorization and persistence

Every independently callable read or mutation authenticates and authorizes itself. Parent layouts, middleware, and client state are not security boundaries. Ownership and tenant identifiers come from authenticated server context, never client payloads, and every persistence operation is scoped to that owner or tenant.

Mutating controls prevent accidental duplicate submission for user experience. Operations that can genuinely duplicate are idempotent at the server boundary; external creates and deletes use stable keys.

Queries select only fields their projection needs. User-growing collections are capped or paginated with an honest truncation signal or total; no list silently clips results.
