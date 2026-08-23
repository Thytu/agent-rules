# Rust profile

This profile applies when the repository root contains `Cargo.toml`. Product choices still belong in `docs/rules/tech-stack.md`; this file fixes the Rust quality contract.

## Workspace foundation

- Pin one exact stable toolchain in `rust-toolchain.toml`; use edition 2024 and Cargo resolver 3. Nightly features are prohibited.
- Application repositories commit `Cargo.lock`. CI and release builds use `--locked`.
- Put package metadata, dependency versions, and lints in the workspace manifest. Member crates inherit them, including `[lints] workspace = true`.
- Workspace Rust lints deny `unsafe_code`; workspace Clippy lints deny broad suppression, debug output, panic paths, and avoidable allocation or cloning. A crate may strengthen the workspace policy, never weaken it.
- Auxiliary tool versions are exact in `scripts/setup-rust-tools.sh`.

Start the root manifest with this baseline, replacing the member list and package metadata rather than weakening the lints:

```toml
[workspace]
resolver = "3"
members = ["crates/REPLACE_ME"]

[workspace.package]
edition = "2024"
rust-version = "1.98"

[workspace.lints.rust]
future_incompatible = { level = "deny", priority = -1 }
rust_2018_idioms = { level = "deny", priority = -1 }
unsafe_code = "deny"
unsafe_op_in_unsafe_fn = "deny"
unused = { level = "deny", priority = -1 }

[workspace.lints.clippy]
all = { level = "deny", priority = -1 }
nursery = { level = "deny", priority = -1 }
pedantic = { level = "deny", priority = -1 }
allow_attributes = "deny"
allow_attributes_without_reason = "deny"
dbg_macro = "deny"
expect_used = "deny"
multiple_crate_versions = "allow"
module_name_repetitions = "allow"
panic = "deny"
todo = "deny"
undocumented_unsafe_blocks = "deny"
unimplemented = "deny"
unwrap_used = "deny"
```

Every member manifest contains `[lints] workspace = true`. Set the same MSRV in `clippy.toml`, with `allow-expect-in-tests = true`, `allow-unwrap-in-tests = true`, and `avoid-breaking-exported-api = false` so application code is checked rather than treated as a public library compatibility surface.

## Required gate

`bash scripts/verify-rust.sh` is the canonical Rust gate. It runs:

1. rustfmt and Taplo format checks;
2. Taplo validation and spelling checks;
3. Clippy across the workspace, all targets, and all features with warnings denied;
4. workspace tests and rustdoc tests;
5. rustdoc with warnings denied;
6. cargo-deny advisories, licenses, duplicate, registry, Git-source, wildcard, and yanked-crate policy;
7. cargo-machete unused-dependency detection.

Use `bash scripts/verify-rust.sh fast` before commit and the complete gate before push. CI installs the pinned tools and runs the same complete command from a clean checkout. A target-platform application adds a required job on every supported OS; Linux-only success does not establish macOS or Windows compatibility.

Add a Cargo entry to `.github/dependabot.yml` when this profile activates: package ecosystem `cargo`, directory `/`, weekly schedule, and one grouped update set. Cargo dependency updates pass the same complete gate as authored changes.

## Types and errors

Use enums for variant state and newtypes for identifiers, paths, secrets, durations, byte counts, and provider references. Each enum variant carries exactly the fields valid in that state. Serde wire types and provider DTOs stop at adapters; domain types do not derive serialization merely for convenience.

Libraries return typed errors with actionable context. Production code does not use `unwrap`, `expect`, `panic`, `todo`, or `unimplemented`. Tests may use `unwrap` or `expect` only for fixture construction where setup failure cannot be confused with the asserted behavior.

Do not use `#[allow]` to silence a warning. Fix the code or use `#[expect(lint, reason = "...")]` at the smallest scope when the code intentionally exhibits the lint and the invariant is durable.

## Async and ownership

Keep every spawned task's `JoinHandle` under an owner that can cancel it and observe its result. Never hold a synchronous lock across `.await`. Tokio channels are bounded and define overload behavior; streaming code bounds retained history and releases buffers when consumers disappear.

Borrow by default. Clone only across a real lifetime or concurrency boundary, with the reason visible from the type or operation. Do not rebuild regexes, clients, parsed configuration, or invariant paths inside loops. Avoid allocation in repeated rendering, parsing, and streaming paths; measure before adding a cache.

## Unsafe code

Safe Rust is the workspace default. A platform boundary that genuinely requires unsafe code must narrow the block, state the safety invariant immediately above it, validate every precondition in a safe wrapper, and use a reasoned lint expectation at the smallest scope.

## Tests

Unit tests may live beside private code when they exercise branching invariants. Public and cross-crate behavior belongs under the owning crate's `tests/` directory. Rustdoc examples are tests when they teach a public contract. Tests are deterministic, parallel-safe, and leave no process, file, socket, or external resource behind.
