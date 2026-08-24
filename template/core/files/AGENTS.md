# Agent map

This file is the only agent-facing index. Vendor filenames are pointer shims, never a second rulebook.

## The lens

Build production software a real user runs. Cuts come only from `SCOPE.md`. Unhappy paths, real scale, and empty/error/permission states are in scope.

## The map

| Topic | Read when | Where |
|---|---|---|
| What to build | starting any feature | `SCOPE.md` |
| Definition of done | before and after building | `docs/scenarios/` |
| Product stack | writing code or changing dependencies | `docs/rules/tech-stack.md` |
| Language profiles | writing language-specific code | `docs/profiles/` |
| House conventions | writing code or tests | `docs/rules/engineering.md` |
| Git, ownership, and sequencing | changing shared files or workflow | `docs/rules/process.md` |
| How to self-verify | before claiming done | `VERIFICATION.md` |

## Commands

| Task | Command |
|---|---|
| Set up repository | `bash scripts/setup.sh` |
| Infrastructure gate | `bash scripts/verify.sh --structure-only` |
| Full gate | `bash scripts/verify.sh` |
| Apply GitHub settings | `bash scripts/setup-github.sh` |
