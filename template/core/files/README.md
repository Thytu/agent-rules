# Generated repository

This repository was materialized from `agent-rules`. Generator source and unselected language tooling are absent.

## First setup

```bash
bash scripts/setup.sh
bash scripts/verify.sh --structure-only
```

Then:

1. Define the product in `SCOPE.md`.
2. Fill `VERIFICATION.md` with runnable product access and smoke paths.
3. Run `bash scripts/verify.sh`.
4. Make the first passing commit.
5. Run `bash scripts/setup-github.sh`.

## Repository workflow

History is append-only: fix forward; never amend, rebase, or force-push. Merge `main` into the branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and preserves every relevant decision and user-visible outcome before merge.

## Stable commands

- `bash scripts/setup.sh` — install pinned selected tooling and hooks.
- `bash scripts/verify.sh --structure-only` — verify repository infrastructure while product contracts are unfinished.
- `bash scripts/verify.sh` — complete repository and product-contract gate.

Selected runtime details live in manifests and configuration; `AGENTS.md` routes each task to the exact rule or verifier.
