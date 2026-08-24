# Contract evolution

Implement one complete contract. Do not leave TODO implementations, no-op substitutes, compatibility shims, deprecated aliases, parallel V2 paths, policy-only placeholder crates, or comments promising later cleanup.

A scope cut is recorded in `SCOPE.md`, and the unavailable path fails explicitly. Change a contract by migrating every caller and deleting the old path in the same change. Compatibility at an uncontrolled external boundary requires an owner-approved specification.
