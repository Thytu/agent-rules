# Process — parallel work without shared-state damage

## Shared ownership

Manifests, lockfiles, toolchain/lint configuration, CI, release configuration, protocol schemas, migrations, and shared primitives are integration-owned. Feature work requests those changes from the integration owner rather than editing them directly. The enforced paths live under `.agent-rules/guarded-paths/`.

A dependency change is atomic: manifest, lockfile, first use/removal, supply-chain result, and unused-dependency result. A pinned stack upgrade changes every coupled runtime, package-manager, installer, checksum, workflow, verifier, and lock in one integration-owned change. Tool versions are exact and application resolution is reproducible from committed locks. Scheduled version-update pull requests are owner opt-in, never the repository default.

## Verification

`bash scripts/verify.sh` is the complete gate and must pass before commit. `bash scripts/verify.sh --structure-only` validates repository infrastructure while initial product contracts are still intentionally incomplete.

Repository checks and product verification are separate evidence. CI reruns the repository gate from a clean checkout; local success never overrides a failed required check.

## Agent map

`AGENTS.md` is the canonical entry point. Vendor filenames are symlink shims or tool configuration, never rules. Rules live under `docs/`; enforcement lives in hooks, selected language tooling, and CI.

## Git

Branch history is append-only: never amend, rebase, or force-push. Fix forward with another commit; merge main into a branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and must preserve every relevant decision before merge. Keep it visual and scannable: short paragraphs, horizontal separators, and tables for before/after states, schemas, procedures, and risks. Describe behavior and outcomes, never file paths.

## Repository setup

After the first passing product commit, run `bash scripts/setup-github.sh`. It configures squash-only merge, automatic branch deletion, no force-push, resolved review threads, the integration-owner variable, required `PR targets main`, `Shared-file ownership`, and `Repository quality` checks, and read-only vulnerability alerts. Automatic security pull requests remain disabled unless the repository owner explicitly opts in; later setup reruns preserve that preference.

## Worktrees and previews

Each worktree is an isolated product instance with unique ports and cwd-local state. Reset affects that worktree only. Preview resources are separate and can never use production names; preview checks remain advisory.
