# Dependency integrity

A dependency change is one atomic unit: manifest, lockfile, first use or complete removal, supply-chain result, and unused-dependency result. Application resolution is reproducible from committed locks.

A pinned-stack upgrade changes every coupled runtime, package manager, installer, checksum, workflow, verifier, and lock together. Tool versions are exact. Scheduled version-update pull requests are owner opt-in, never the repository default.
