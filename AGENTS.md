# Agent map

This is the only agent-facing index. Vendor entry points are pointer shims, never a second rulebook.

## The lens

Build production software a real user runs. Do not cut requested behavior without explicit approval. Unhappy paths, real scale, and empty/error/permission states are in scope.

## The map

| Topic | Read when | Where |
|---|---|---|
| Generator behavior | changing initialization or templates | `README.md` |
| Boundary modeling and failures | changing input, output, types, adapters, or errors | `docs/rules/boundaries.md` |
| Authorization and persistence | changing a callable read, mutation, query, or stored data | `docs/rules/authorization-persistence.md` |
| Lifecycle and capacity | changing tasks, resources, retries, queues, or previews | `docs/rules/lifecycle-capacity.md` |
| Contract evolution | changing an API, schema, migration, or implementation path | `docs/rules/contract-evolution.md` |
| Efficiency | changing repeated work, allocation, copying, parsing, or caching | `docs/rules/efficiency.md` |
| Testing | writing or changing tests | `docs/rules/testing.md` |
| Comments | adding or changing comments | `docs/rules/comments.md` |
| Dependency integrity | changing dependencies, tools, runtimes, or pins | `docs/rules/dependency-integrity.md` |
| Rust output | changing Rust materialization or enforcement | `template/rust/files/Cargo.toml`, `template/rust/files/scripts/verify-rust.sh` |
| TypeScript output | changing TypeScript materialization or enforcement | `template/typescript/files/package.json`, `template/typescript/files/scripts/verify-typescript.sh` |
| Repository workflow | before committing, synchronizing, or preparing a pull request | `README.md` |
| Autopilot | orchestrating a complete task in an isolated worktree | `.agents/skills/autopilot/SKILL.md` |
| Create pull requests | preparing a pull request | `.agents/skills/create-pr/SKILL.md` |
| Root-cause analysis | investigating a failure | `.agents/skills/root-cause/SKILL.md` |
| Judge loops | challenging a plan or diff | `.agents/skills/judge-loop/SKILL.md` |
| Headless lanes | delegating autonomous implementation | `.agents/skills/running-headless-lanes/SKILL.md` |
| Rule-owner review | changing reviewer behavior | `tooling/pr-review/README.md` |

## Commands

| Task | Command |
|---|---|
| Set up source checkout | `bash scripts/setup-source.sh` |
| Full source gate | `pnpm verify` |
| Initialize Rust repository | `./init.sh rust` |
| Initialize TypeScript repository | `./init.sh typescript` |
| Initialize mixed repository | `./init.sh rust,typescript` |

