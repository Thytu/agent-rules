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

1. Fill `SCOPE.md`, `docs/rules/tech-stack.md`, `VERIFICATION.md`, and real scenarios.
2. Run `bash scripts/verify.sh`.
3. Commit the initialized product repository.
4. Run `bash scripts/setup-github.sh` to install repository settings and required checks.

## Develop the generator

```bash
bash scripts/setup-source.sh
pnpm verify
```

The source reviewer remains source-only. No generated repository receives model dependencies, credentials, or reviewer code.
