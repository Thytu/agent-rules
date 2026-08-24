# Testing

A test pins an observable contract the code could plausibly violate. Expected values come from the boundary, bug, or independent specification, never by re-reading the implementation.

Tests are deterministic, parallel-safe, blank local secrets, isolate resources, and leave no process, file, socket, account, or external state behind. Private branching invariants may use unit tests; public behavior belongs in the owning language's integration or public-documentation test surface.

Mock only process boundaries. Assertions observe behavior; mock-call assertions may corroborate but never stand alone. Reject pass-through tautologies, snapshot-as-coverage, copied prompt literals, and assertions of type-system guarantees.
