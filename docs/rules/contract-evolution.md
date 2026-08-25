# Contract evolution

## Review scope

Apply this owner when changed production code leaves required behavior unimplemented or makes old and new forms of the same contract coexist. The repository must establish the contract being evolved. Runtime probing that accepts legacy and current forms is a compatibility shim; a duplicate suffixed implementation is a parallel path. A comment that merely cites a plan or scope item does not establish that the pull request cut required behavior; comment quality belongs to the comments owner. Do not infer a contract defect from missing imports, abbreviated context, mechanical build errors, ordinary implementation choices, or unchanged callers. Test quality, dependency manifests, authorization, error handling, and asynchronous ownership belong to their respective owners unless the changed code explicitly presents them as a temporary placeholder or compatibility mechanism.

## Requirements

Implement one complete contract. Do not leave TODO implementations, unconditional no-op substitutes, compatibility shims, deprecated aliases, parallel V2 paths, policy-only placeholders, or comments promising later behavior or cleanup. Catching or propagating an operational failure belongs to the boundary and lifecycle owners, not contract evolution. An explicit failure for unavailable configuration or unsupported behavior is complete. A deliberately disabled environment that returns an explicit non-success `skipped` outcome is also complete.

A scope cut requires explicit owner approval, and the unavailable path fails explicitly. Change a contract by migrating every caller and deleting the old path in the same change. Compatibility at an uncontrolled external boundary requires an owner-approved specification.
