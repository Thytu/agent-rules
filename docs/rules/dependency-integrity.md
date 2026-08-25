# Dependency integrity

## Review scope

Apply this owner only when the pull request changes a dependency, runtime, tool, installer, checksum, workflow pin, or dependency-update policy. Editing a manifest without changing those concerns is not a dependency finding. Mechanical syntax and formatting belong to their normal checks.

## Requirements

A dependency change is one atomic unit: manifest, lockfile, first use or complete removal, supply-chain result, and unused-dependency result. Application resolution is reproducible from committed locks.

A pinned-stack upgrade changes every coupled runtime, package manager, installer, checksum, workflow, verifier, and lock together. Tool versions are exact. Scheduled version-update pull requests are owner opt-in, never the repository default.
