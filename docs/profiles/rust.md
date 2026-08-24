# Rust profile

This profile applies when the repository root contains `Cargo.toml`.

## Workspace

- Exact stable toolchain in `rust-toolchain.toml`; edition 2024; resolver 3; no nightly.
- Commit `Cargo.lock`; every CI/release command uses `--locked`.
- Workspace package metadata, dependency versions, and lints are inherited by every member.
- Workspace lints deny unsafe code, broad suppression, debug output, panic paths, unimplemented paths, and avoidable allocation/cloning.
- An initially empty workspace is valid. Add the first real product crate directly; never add a policy-only placeholder crate.

## Gate

`bash scripts/verify-rust.sh` validates the workspace manifest, lock, toolchain, rustfmt, Taplo, spelling, and cargo-deny policy. With zero packages it stops after those meaningful checks. Once a real package exists it additionally requires workspace Clippy, tests, doctests, rustdoc with warnings denied, and cargo-machete.

`bash scripts/setup-rust.sh` installs exact locked auxiliary tool versions. CI runs the same complete gate from a clean checkout.

## Types, errors, and ownership

Use enums for variant state and newtypes for identifiers, paths, secrets, durations, byte counts, and provider references. Provider DTOs stop at adapters. Libraries return typed errors with actionable context. Production code does not use unwrap, expect, panic, todo, or unimplemented.

Do not silence warnings with broad `allow`. Fix the code or use the smallest reasoned `expect` when an invariant is intentional.

Every spawned task has an owner that can cancel it and observe its result. Never hold a synchronous lock across await. Channels and retained streaming history are bounded. Borrow by default; clone only across a real lifetime/concurrency boundary.

Safe Rust is the workspace default. A genuine platform boundary narrows unsafe code, documents the invariant immediately above it, and validates every precondition in a safe wrapper.

## Tests

Private branching invariants may use unit tests. Public/cross-crate behavior belongs under the owning crate's `tests/`; rustdoc examples test public contracts. Tests are deterministic, parallel-safe, and clean up every resource.
