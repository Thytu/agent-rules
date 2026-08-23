# Verification — the ground-truth gate

We do **not** dictate the method (no mandated Playwright). We provision access. A feature is not done until a reviewer has exercised the real thing and shown the result.

Pure-aesthetic choices have no functional oracle. Everything functional, the agent proves itself.

## Capability inventory

Fill a row when the surface exists. Each row needs a cold-start how-to and a smoke that an agent can re-run.

| # | Surface | How an agent accesses it (cold) | Smoke | Status |
|---|---------|--------------------------------|-------|--------|
| 1 | Running instance + test accounts | `REPLACE_ME` | | ⬜ |
| 2 | Seed + reset | `REPLACE_ME` | | ⬜ |
| 3 | Database / direct query | `REPLACE_ME` | | ⬜ |
| 4 | Side effects (email, jobs, webhooks) | Agent-queryable sink, not a live third party | | ⬜ |

## Swarm rules

- Cloud singletons (prod DB, live keys, real third parties) belong to the integration lane. Feature agents verify against local oracles.
- Local green ≠ deployed green. The deployed smoke is the oracle that counts.

## Evidence by change kind

- **Bug fix:** reproduce the failure before the change, then exercise the same path and observe that it no longer fails.
- **Functional or API change:** run the repository gate, then exercise the changed contract through its real boundary.
- **UI change:** use the running surface and verify interaction, loading, empty, error, permission, keyboard, and narrow-viewport behavior that the change can affect.
- **Provider or infrastructure change:** verify both product state and the provider's real resource state, including cleanup.

Compilation, types, lint, unit tests, mocks, and repository checks are necessary evidence where applicable. None substitutes for the product smoke.
