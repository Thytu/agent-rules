# Agent map

This file is the only agent-facing index. Vendor filenames are pointer shims, never a second rulebook.

## The lens

Build production software a real user runs. Do not cut requested behavior without explicit approval. Unhappy paths, real scale, and empty/error/permission states are in scope.

## The map

| Topic | Read when | Where |
|---|---|---|
| Boundary modeling and failures | changing input, output, types, adapters, or errors | `docs/rules/boundaries.md` |
| Authorization and persistence | changing a callable read, mutation, query, or stored data | `docs/rules/authorization-persistence.md` |
| Lifecycle and capacity | changing tasks, resources, retries, queues, or previews | `docs/rules/lifecycle-capacity.md` |
| Contract evolution | changing an API, schema, migration, or implementation path | `docs/rules/contract-evolution.md` |
| Efficiency | changing repeated work, allocation, copying, parsing, or caching | `docs/rules/efficiency.md` |
| Testing | writing or changing tests | `docs/rules/testing.md` |
| Comments | adding or changing comments | `docs/rules/comments.md` |
| Dependency integrity | changing dependencies, tools, runtimes, or pins | `docs/rules/dependency-integrity.md` |
<!-- LANGUAGE_ROWS -->
| Repository workflow | before committing, synchronizing, or preparing a pull request | `README.md` |
| How to self-verify | before claiming done | `VERIFICATION.md` |

## Commands

| Task | Command |
|---|---|
| Set up repository | `bash scripts/setup.sh` |
| Infrastructure gate | `bash scripts/verify.sh --structure-only` |
| Full gate | `bash scripts/verify.sh` |
| Apply GitHub settings | `bash scripts/setup-github.sh` |

