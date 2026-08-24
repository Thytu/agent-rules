# Verification — generator ground truth

The source gate is `pnpm verify`. It must prove the materializer and every emitted repository boundary, not merely lint source files.

## Required evidence

1. Generate Rust, TypeScript, and mixed outputs in fresh temporary Git repositories.
2. Compare each pristine output with its committed complete path golden.
3. Run structural setup and verification in every output.
4. Exercise the selected language verifier in each mode.
5. Prove unselected runtimes, configs, dependencies, commands, and prose are absent.
6. Prove invalid mode, dirty/staged/untracked/ignored input, collision, hostile Git environment, and injected copy failure leave the original checkout byte/mode/symlink identical.
7. Prove product paths added after initialization are permitted while generator, unselected, and guarded ownership paths remain enforced.
8. Validate initial GitHub setup enables vulnerability alerts and disables automatic security pull requests, later setup reruns preserve the owner's explicit preference, and optional Dependabot remediation remains limited to manifests and locks.
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

The default generated gate intentionally fails until product placeholders and the untouched example scenario are replaced.
