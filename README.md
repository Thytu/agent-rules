# agent-rules

One-shot rules and tooling materializer for new repositories.

## Initialize a new repository

Create a repository from this GitHub template, then run exactly one command before adding files:

The source repository also carries auto-discovered workflows under `.agents/skills/`; they remain source-only and are removed by materialization.

```bash
./init.sh rust
./init.sh typescript
./init.sh rust,typescript
```

Initialization copies a language-neutral core plus only the selected language trees, validates the complete output in a temporary directory, replaces the template payload with rollback protection, installs selected tooling, and removes the generator.

It intentionally rejects the canonical `Thytu/agent-rules` checkout, non-`main` branches, tracked changes, staged changes, and every untracked or ignored filesystem entry. It never adapts an existing application.

After initialization:

1. Run `bash scripts/verify.sh`.
2. Commit the initialized product repository.
3. Run `bash scripts/setup-github.sh` to install repository settings, required checks, and vulnerability alerts without scheduled dependency-update pull requests.

## Repository workflow

History is append-only: fix forward; never amend, rebase, or force-push. Merge `main` into the branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and preserves every relevant decision and user-visible outcome before merge.

## Develop the generator

```bash
bash scripts/setup-source.sh
pnpm verify
```

The source reviewer remains source-only. No generated repository receives model dependencies, credentials, or reviewer code.
