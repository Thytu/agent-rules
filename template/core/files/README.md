# Generated repository

This repository was materialized from `agent-rules`. Generator source and unselected language tooling are absent.

## First setup

```bash
bash scripts/setup.sh
bash scripts/verify.sh --structure-only
```

Then:

1. Define the product in `SCOPE.md`.
2. Lock product choices in `docs/rules/tech-stack.md`.
3. Replace `docs/scenarios/00-example.yaml` with real scenarios.
4. Fill `VERIFICATION.md` with runnable product access and smoke paths.
5. Run `bash scripts/verify.sh`.
6. Make the first passing commit.
7. Run `bash scripts/setup-github.sh`.

## Stable commands

- `bash scripts/setup.sh` — install pinned selected tooling and hooks.
- `bash scripts/verify.sh --structure-only` — verify repository infrastructure while product contracts are unfinished.
- `bash scripts/verify.sh` — complete repository and product-contract gate.

Selected language details live under `docs/profiles/`.
