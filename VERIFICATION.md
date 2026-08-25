# Verification — generator ground truth

The source gate is `pnpm verify`. It must prove the materializer and every emitted repository boundary, not merely lint source files.

## Required evidence

1. Generate Rust, TypeScript, and mixed outputs in fresh temporary Git repositories.
2. Compare each pristine output with its committed complete path golden.
3. Run structural setup and verification in every output.
4. Exercise the selected language verifier in each mode.
5. Prove unselected runtimes, configs, dependencies, commands, and prose are absent.
6. Prove invalid mode, dirty/staged/untracked/ignored input, collision, hostile Git environment, and injected copy failure leave the original checkout byte/mode/symlink identical.
7. Prove generated output omits generator and unselected runtime files while accepting ordinary product paths.
8. Validate GitHub setup enables vulnerability alerts, preserves the repository's automated security pull-request preference, and requires only the main-target and repository-quality checks.
9. Validate source-only AI review checks out base code and fetches head as data without candidate execution.

## Commands

```bash
bash scripts/setup-source.sh
pnpm verify
```

Generated repositories use:

```bash
bash scripts/setup.sh
bash scripts/verify.sh --structure-only
bash scripts/verify.sh
```

The default generated gate intentionally fails until the product placeholders are replaced.
