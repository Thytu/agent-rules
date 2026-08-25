# Boundaries

## Review scope

Apply this owner only where changed production code actually crosses an untrusted or provider shape boundary, discards a failure, or introduces competing representations of one contract. Repository evidence must identify the boundary or competing contract. Explicitly discarding a promise also discards its possible rejection and is a failure-boundary violation, independent of who owns cancellation. An exported validator or parser that unconditionally accepts input is itself a failed boundary. A duplicate suffixed API, serializer, or runtime reader for old and new shapes is a competing representation unless an uncontrolled external contract proves it necessary. An alternate export name that aliases the identical callable and data shape belongs to contract evolution, not this owner. Generic parameters, local object shapes, rows produced by the repository's modeled application schema, prepared internal operations, tests, comments, missing type annotations, and mechanical compile or import errors are outside this owner. Identifier provenance belongs to authorization; asynchronous ownership and cancellation belong to lifecycle. Do not demand a wrapper type merely because a value has an identifier-like name.

## Requirements

Settle untrusted and provider-owned shapes once at a deliberate edge. Everything below receives modeled values. A deliberate finite union of modeled inputs that is normalized once at function entry is one contract, not competing representations. Program-produced variants use enums, discriminated unions, overloads, or narrower parameters rather than ambiguous optional-field bags and repeated runtime probing.

Give semantic identities distinct types where accidental interchange is both plausible and harmful: identifiers, paths, secrets, durations, byte counts, and provider references. Provider DTOs stop at adapters.

Failures remain failures until a boundary deliberately presents them. Never discard an error or convert failure into empty, null, default, or apparent success. Propagating or explicitly throwing a failure is compliant. An intentional environment-specific bypass that returns an explicit `skipped` outcome is not apparent success. Libraries return typed errors with actionable operation context and no leaked secrets.
