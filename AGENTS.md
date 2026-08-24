# Agent map

This is the only agent-facing index. Vendor entry points are pointer shims, never a second rulebook.

## The lens

Build production software a real user runs. Cuts come only from `SCOPE.md`. Unhappy paths, real scale, and empty/error/permission states are in scope.

## The map

| Topic | Read when | Where |
|---|---|---|
| Generator product | changing initialization or templates | `SCOPE.md` |
| Core engineering rules | changing emitted rules | `docs/rules/` |
| Generated language profiles | changing Rust or TypeScript output | `docs/profiles/` |
| Reusable agent workflows | creating PRs, RCA, judge loops, or headless lanes | `.agents/skills/` |
| Generator verification | before claiming done | `VERIFICATION.md` |
| Rule-owner review | changing reviewer behavior | `tooling/pr-review/README.md` |

## Commands

| Task | Command |
|---|---|
| Set up source checkout | `bash scripts/setup-source.sh` |
| Full source gate | `pnpm verify` |
| Initialize Rust repository | `./init.sh rust` |
| Initialize TypeScript repository | `./init.sh typescript` |
| Initialize mixed repository | `./init.sh rust,typescript` |
