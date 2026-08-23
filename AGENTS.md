# Agent map

This file is the only agent-facing index. Vendor filenames (`CLAUDE.md`, `.cursor/`, …) are pointer shims, never a second rulebook.

## THIS FILE IS A MAP — keep it one

One row per topic, pointing to where the depth lives. **Never add rule prose, checklists, or explanations here.** A new code convention goes in `docs/rules/engineering.md`, a new workflow rule in `docs/rules/process.md`, everything else in its mapped doc — then add or update ONE map row if a new topic exists. `scripts/check-map.sh` (in `pnpm verify`) fails if this file exceeds 60 lines, maps a missing path, or `CLAUDE.md` stops being a symlink.

## The lens

You are building production software a real user runs. Cuts come only from `SCOPE.md`. Unhappy paths, real scale, and empty/error/permission states are in scope. Reviewers hold work to this bar, not to "it runs."

## The map

| Topic | Read when | Where |
|---|---|---|
| What to build | starting any feature | `SCOPE.md` |
| Definition of done | before AND after building | `docs/scenarios/` |
| Platform (wins conflicts) | writing any code | `docs/rules/tech-stack.md` |
| Rust profile | writing Rust or changing Cargo files | `docs/profiles/rust.md` |
| House conventions | writing any code or tests | `docs/rules/engineering.md` |
| Process — git, worktrees, shared files | schema/deps/git/sequencing | `docs/rules/process.md` |
| Design system | building any UI | `docs/rules/design-system.md` |
| Eval-harness survival | building judged UI | `docs/rules/harness.md` |
| How to self-verify | before claiming done | `VERIFICATION.md` |
| Rule-owner PR review | acting on it or changing it | `tooling/pr-review/README.md` |

## Commands

| Task | Command |
|------|---------|
| **Full check before you commit** | `pnpm verify` |
| **Apply GitHub repo settings** | `bash scripts/setup-github.sh` |
