# Testing

## Review scope

Review test code, test-support code, and changes that delete or disable existing coverage. Production code is not itself a testing violation merely because the same pull request does not add a test; another document must explicitly require that test. Do not infer weak coverage from test names, mocks, or helpers without reading the changed assertions and the observable contract they claim to protect.

## Requirements

A test pins an observable contract the code could plausibly violate. Expected values come from the boundary, bug, or independent specification, never by re-reading the implementation. An assertion that a failed external operation exposes its operation name and provider status is a behavioral error contract, not a re-derived oracle merely because the implementation constructs that error.

Tests are deterministic, parallel-safe, blank local secrets, isolate resources, and leave no process, file, socket, account, or external state behind. Private branching invariants may use unit tests; public behavior belongs in the owning language's integration or public-documentation test surface.

Mock only nondeterministic or process boundaries. Injected clocks, random sources, filesystems, networks, databases, and provider adapters are boundary substitutes; small deterministic fakes for them are allowed. Assertions observe behavior; mock-call assertions may corroborate but never stand alone. Reject pass-through tautologies, snapshot-as-coverage, copied prompt literals, and assertions of type-system guarantees.
