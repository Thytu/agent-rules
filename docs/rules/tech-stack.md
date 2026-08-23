# Tech stack

The locked stack. If something here conflicts with another doc, this wins.

## Platform

| Concern | Choice |
|---|---|
| Runtime | `REPLACE_ME` |
| Database | `REPLACE_ME` |
| Object storage | `REPLACE_ME` |
| Jobs | `REPLACE_ME` |
| Auth | `REPLACE_ME` |

## Language & libraries

| Layer | Choice | Pin |
|---|---|---|
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | — |
| Package manager | pnpm | lockfile-pinned |
| Lint | ESLint (flat) + house rules in `tooling/eslint-rules/` | 9.x |
| Format | Biome — formatter only; its linter is disabled | 2.x |
| Tests | `REPLACE_ME` — run against the real local runtime and DB | — |

Exact patch versions are frozen in `package.json`.

## Optional Rust profile

When `Cargo.toml` exists, [`docs/profiles/rust.md`](../profiles/rust.md) is mandatory in addition to this file. It defines the workspace, toolchain, quality, dependency, ownership, async, and unsafe-code contract. The presence of `Cargo.toml` activates the Rust repository gate and Rust rule-owner review; non-Rust repositories pay neither cost.

## Ports (the only swappable seams)

Everything that differs between local and cloud sits behind a typed interface with a local and a prod adapter. Nothing else gets a port.

| Port | Prod adapter | Local / test adapter |
|---|---|---|
| `REPLACE_ME` | | |

**Timeouts:** an outbound `fetch` that builds an options object must pass a `signal`. A third party that answers with an error is the outage everyone handles; one that accepts the connection and then says nothing is the one that gets forgotten.

## Platform rules (mandatory)

- Shared files are integration-owned + guarded (`scripts/guard-shared.sh`): schema, migrations, seed, `package.json`, lockfile, platform config, design primitives. Feature worktrees do not `pnpm add`.
- Protect mutations at the mutation. A layout loader is not a security boundary.
- File-based ownership for routes / jobs / nav so N agents do not edit one registry. Fill the convention here once the app exists.

## Local development & worktree isolation

N concurrent, fully isolated local instances — one per git worktree — with zero cross-instance overlap.

- Unique port, cwd-local state, no shared service bindings.
- Reset wipes that worktree only.
- Migrations are authored on the integration branch and consumed by worktrees.

## Not using (and why)

| Rejected | Use instead | Why not |
|---|---|---|
| `REPLACE_ME` | | |
