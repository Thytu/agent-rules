# Generated repository

This repository was materialized from `agent-rules`. Generator source and unselected language tooling are absent.

<!-- SELECTION -->

## First setup

After `init.sh`, commit the initialized tree. The commit gate verifies it:

```bash
git add -A && git commit -m "chore: initialize repository"
git push
bash scripts/setup-github.sh
```

On a fresh clone, run `bash scripts/setup.sh` first: it installs the pinned tooling and activates the Git hooks.

## Repository workflow

History is append-only: fix forward; never amend, rebase, or force-push. Merge `main` into the branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and preserves every relevant decision and user-visible outcome before merge.

## Gates

| Gate | Runs | Checks |
|---|---|---|
| Commit | every commit and merge commit (`scripts/verify-commit.sh`) | exactly the staged tree: repository structure, file sizes, secrets in the staged changes, duplication, and each language's formatting, lint, types, and tests with coverage floors, plus add-on checks. Dependency advisories run when a dependency file is staged. |
| Push | every push (`scripts/verify.sh`) | the commit gate on `HEAD`, plus dependency advisories, a secret scan of the history, and add-on builds |
| Pull request | GitHub Actions | the push gate, a Gitleaks scan of every commit, and add-on workflows |
| Main | after each merge | `scripts/test-stability.sh`: every test suite three times; a test whose outcome changes is reported as flaky |

The commit gate refuses unstaged or untracked changes beside the commit, because they could hide a failure in what is committed. Stage them, or set them aside with `git stash push --keep-index --include-untracked`.

## Stable commands

- `bash scripts/setup.sh` — install pinned selected tooling and hooks.
- `bash scripts/verify.sh --structure-only` — verify repository infrastructure without running the selected language gates.
- `bash scripts/verify.sh --commit` — the commit gate against the staged tree.
- `bash scripts/verify.sh` — the full gate.
- `bash scripts/test-stability.sh` — run every test suite three times and report flaky tests.

Selected runtime details live in manifests and configuration; `AGENTS.md` routes each task to the exact rule or verifier.
