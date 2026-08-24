# SCOPE — agent-rules materializer

## North star

A new repository owner chooses Rust, TypeScript, or both and receives one clean, production-grade rules/tooling baseline with no dormant unselected runtime.

## In scope

- Exactly `./init.sh rust`, `./init.sh typescript`, and `./init.sh rust,typescript`.
- Literal allow-listed core and language overlays.
- Deterministic `.gitignore` and Dependabot composition.
- Temporary validation, collision rejection, byte-preserving rollback, and source removal.
- Generated setup, hooks, guarded ownership, CI, and full verification.
- Source-only generator tests and advisory rule-owner review.

## Out of scope

- Retrofitting an existing application.
- Optional capability flags or a plugin/profile language beyond the three commands.
- Emitting source UI/design-system or judged-harness examples.
- Emitting the AI reviewer or any model credential/runtime.

Cuts are authorized only here or in `docs/scenarios/GAP-REGISTER.md`.
