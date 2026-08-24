# Generated repository

This repository was materialized from `agent-rules`. Generator source and unselected language tooling are absent.

## First setup

```bash
bash scripts/setup.sh
bash scripts/verify.sh --structure-only
```

Then:

1. Define the product in `SCOPE.md`.
2. Replace `docs/scenarios/00-example.yaml` with real scenarios.
3. Fill `VERIFICATION.md` with runnable product access and smoke paths.
4. Run `bash scripts/verify.sh`.
5. Make the first passing commit.
6. Run `bash scripts/setup-github.sh`.

## Stable commands

- `bash scripts/setup.sh` — install pinned selected tooling and hooks.
- `bash scripts/verify.sh --structure-only` — verify repository infrastructure while product contracts are unfinished.
- `bash scripts/verify.sh` — complete repository and product-contract gate.

Selected language details live under `docs/profiles/`.
