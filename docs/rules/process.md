# Process — parallel work without shared-state damage

## Shared ownership

Manifests, lockfiles, toolchain/lint configuration, CI, release configuration, protocol schemas, migrations, and shared primitives are integration-owned. Feature work requests those changes from the integration owner rather than editing them directly. The enforced paths live under `.agent-rules/guarded-paths/`.

A dependency change is atomic: manifest, lockfile, first use/removal, supply-chain result, and unused-dependency result. Tool versions are exact and application resolution is reproducible from committed locks.

## Verification

`bash scripts/verify.sh` is the complete gate and must pass before commit. `bash scripts/verify.sh --structure-only` validates repository infrastructure while initial product contracts are still intentionally incomplete.

Repository checks and product verification are separate evidence. CI reruns the repository gate from a clean checkout; local success never overrides a failed required check.

## Agent map

`AGENTS.md` is the canonical entry point. Vendor filenames are symlink shims or tool configuration, never rules. Rules live under `docs/`; enforcement lives in hooks, selected language tooling, and CI.

## Git

Branch history is append-only: never amend, rebase, or force-push. Fix forward with another commit; merge main into a branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and must preserve every relevant decision before merge.

## Repository setup

After the first passing product commit, run `bash scripts/setup-github.sh`. It configures squash-only merge, automatic branch deletion, no force-push, resolved review threads, the integration-owner variable, and required `PR targets main`, `Shared-file ownership`, and `Repository quality` checks.

## Worktrees and previews

Each worktree is an isolated product instance with unique ports and cwd-local state. Reset affects that worktree only. Preview resources are separate and can never use production names; preview checks remain advisory.
