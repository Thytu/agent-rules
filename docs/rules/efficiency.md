# Efficiency

## Review scope

Apply this owner only when repository evidence proves that changed production code repeats work along one execution path or introduces a measured resource regression. The repeated path and invariant work must both be concrete. One-time setup, small statically bounded values, tests, comments, and hypothetical future scale are not efficiency findings. Do not recommend caches or ownership changes without evidence that the work repeats.

## Requirements

Do not allocate, clone, copy, serialize, fetch, parse, or recompute invariant data in repeated paths when ownership or initialization can do it once. Borrow by default; clone only across a real lifetime or concurrency boundary.

Reuse compiled patterns, provider clients, parsed configuration, and invariant paths. Add caches only after measurement and with explicit invalidation.
