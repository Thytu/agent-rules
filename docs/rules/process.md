# Process — how work flows across parallel agents

## Shared-file protocol [hook-enforced: `scripts/guard-shared.sh`]

Schema, migrations, seed, `package.json`, the lockfile, platform config, and design primitives are authored on the integration branch and consumed by worktrees. A lefthook pre-commit blocks feature-branch commits that touch them. Need a column, dependency, binding, or primitive? Request it from the integration owner (override: `ALLOW_SCHEMA_CHANGE=1`). All stack deps are pre-installed and frozen — do not `pnpm add`.

Edit the guarded path list at the top of `scripts/guard-shared.sh` when this repo's paths exist.

## Design-time gate (integration owner)

Any change to schema, a port, or a spec must **re-walk** the scenarios whose `touches:` header names the changed artifact — produce the concrete artifact for each affected step, not a mechanism name. Walk every matching step. The affected / unaffected determination is made DURING the walk — never by pre-filtering the step list.

## Worktree isolation

Each worktree is a full instance: unique port, cwd-local state, no service bindings. Reset in one worktree never touches another.

## Verification

`pnpm verify` = map check + lint + tooling tests, and it must pass before commit. Formatting is Biome (`pnpm format`). A lefthook pre-commit runs format + lint + the shared-file guard + the AGENTS.md map check. Pre-push runs `pnpm verify`.

## Agent harness — one map, vendor shims [hook-enforced: `scripts/check-map.sh`]

`AGENTS.md` is the canonical entry point. Vendor filenames and dirs (`CLAUDE.md`, `.claude/`, `.cursor/`, …) are symlink shims or tool configuration only, **never rules**. Rules live in `docs/`. Enforcement lives in git hooks + ESLint + CI. `check-map.sh` fails if a shim stops being a symlink, if the map exceeds 60 lines, if a mapped path is missing, or if a nested `AGENTS.md` / `CLAUDE.md` appears. Adopting a new tool = add its shim, nothing else.

## Git — append forward, squash in [hook-enforced: `scripts/guard-append-only.sh`]

**Branch history is append-only.** Never `--amend`, never rebase, never force-push. Fix a bad commit with another commit; catch up with main by merging it in. Hooks block all three.

**Everything lands by squash-merge, and the branch dies.** One squashed commit per PR on main; its body = the PR title + description. Write the PR description as the decision record. Anything decided en route lives there or in a SCOPE / register row, never only in branch commits.

**Reviewer obligation:** *"can this branch be deleted losing nothing — does the description carry every decision made along the way?"* No → the description is fixed before merge.

**Repo-setup checklist (when the GitHub remote is created):** `bash scripts/setup-github.sh` — ruleset on ALL branches blocking force pushes · main takes PRs only · squash-only merging with default message "PR title and description" · auto-delete head branches. Settings do not copy with "Use this template".

## Build sequencing (waves)

The build is **waves**, not flat parallelism. One **integration owner** owns the integration branch (and schema). Shared spines are domain functions, not inlined in a route.

## Isolated previews

Same-repo PRs that pass quality MAY get an isolated preview. Isolation is scripts + separate resources, not "hope." Preview jobs are advisory — they must not be a required merge check. Preview scripts refuse production resource names.
