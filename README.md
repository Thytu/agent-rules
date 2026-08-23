# agent-rules

Rules and gates for a repo that multiple coding agents will touch.

Not a product. Use this template, fill the `REPLACE_ME` fields, then add the app.

## Use it

1. **Use this template** → create the new repo (don't fork, don't clone this one).
2. `pnpm install`
3. `bash scripts/setup-github.sh` — settings don't copy with the files. Squash-only, auto-delete heads, no force-push, main is PR-only.
4. First hour below.

## What you get

| Surface | Role |
|---|---|
| `AGENTS.md` | The only agent-facing map. Vendor names (`CLAUDE.md`, …) are shims. |
| `SCOPE.md` | What to build. The only place cuts are authorized. |
| `.agents/skills/` | Auto-discovered workflows for PRs, root-cause analysis, judge convergence, and headless lanes; Claude's project skill directory points here. |
| `docs/rules/` | Platform, house conventions, process, design, harness survival. |
| `docs/scenarios/` | Definition of done. Reviewers execute these, not checklists. |
| `VERIFICATION.md` | How an agent proves a feature against the real thing. |
| `scripts/check-map.sh` | Map stays short, paths exist, `CLAUDE.md` stays a symlink. |
| `scripts/guard-shared.sh` | Feature branches cannot touch integration-owned files. |
| `scripts/guard-append-only.sh` | No amend / rebase / force-push. |
| `tooling/eslint-rules/` | House rules: no deferrals, no shims, no runtime `typeof`, meaningful tests. |
| `tooling/pr-review/` | One DeepSeek rule-owner session per `docs/rules/*.md`. |
| `.github/workflows/ci.yml` | Base-must-be-main, shared-file guard, quality, advisory AI review. |
| `scripts/setup-github.sh` | Apply the GitHub repo-setup checklist to a new remote. |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR body is the decision record. The branch dies at squash-merge. |

## First hour on a new product

1. Write the product in `SCOPE.md` and delete the `REPLACE_ME` banner.
2. Lock the stack in `docs/rules/tech-stack.md`.
3. Extend the guarded path list in `scripts/guard-shared.sh` when schema / platform files exist.
4. Fill `VERIFICATION.md` with a cold-start path to a running instance.
5. Replace `docs/scenarios/00-example.yaml` with real scenarios.
6. Optional: set the `DEEPSEEK_API_KEY` repo secret to turn on advisory rule-owner review.

## Commands

```bash
pnpm install
pnpm verify          # map + lint + tooling tests
pnpm format          # Biome, formatter only
```

`pnpm verify` must be green before commit. Lefthook runs the same gate on pre-commit / pre-push.

