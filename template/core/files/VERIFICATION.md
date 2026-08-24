# Verification — ground truth

A feature is not done until a reviewer exercises the real thing and observes the result. Compilation, types, lint, unit tests, mocks, and repository checks are necessary where applicable; none substitutes for a product smoke.

## Capability inventory

| Surface | Cold-start access | Repeatable smoke | Status |
|---|---|---|---|
| Running product | `REPLACE_ME` | | ⬜ |
| Seed and reset | `REPLACE_ME` | | ⬜ |
| Persistence/query | `REPLACE_ME` | | ⬜ |
| Side effects | `REPLACE_ME` | | ⬜ |

## Evidence by change kind

- Bug fix: reproduce before, exercise the same boundary after.
- Functional/API change: run the repository gate, then the real contract.
- UI change: verify interaction, loading, empty, error, permission, keyboard, touch, and narrow viewport states affected.
- Infrastructure/provider change: verify both product state and provider truth, including cleanup.
