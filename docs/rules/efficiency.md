# Efficiency

Do not allocate, clone, copy, serialize, fetch, parse, or recompute invariant data in repeated paths when ownership or initialization can do it once. Borrow by default; clone only across a real lifetime or concurrency boundary.

Reuse compiled patterns, provider clients, parsed configuration, and invariant paths. Add caches only after measurement and with explicit invalidation.
