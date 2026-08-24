# Scenario suite

Scenarios are verb-shaped end-to-end definitions of done. Reviewers execute them against the running product.

## File format (`NN-module.yaml`)

```yaml
module: example
touches:
  files: []
  tables: []
  ports: []
  routes: []
scenarios:
  - id: EX-S1
    name: Concrete name
    persona: user
    steps: |
      1. Perform a concrete action with concrete values.
    success_signals:
      - Observe a concrete product outcome.
      - "EXPERIENCE: describe what the user sees happen."
```

## Rules

- Every scenario carries at least one `EXPERIENCE:` signal.
- Lists are exercised at real scale.
- Unhappy paths are steps, not footnotes.
- A change to a named file, schema, port, or route re-walks every scenario whose `touches` field names it.
- Each walked step produces the concrete serving artifact and records unresolved gaps in `GAP-REGISTER.md`.
