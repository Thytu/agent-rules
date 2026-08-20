# Scenario suite — the verb-shaped ground truth

End-to-end user scenarios (persona → steps → observable success signals). These are the product's **definition of done**: reviewer agents verify features by executing scenario steps against the running instance — never by feature checklists.

Design changes (schema / ports / specs) must be re-walked against the scenarios whose `touches:` header names the changed artifact.

## Why this exists

Inventory validation ("does every noun exist?") misses seams. Scenarios are verb-shaped: they force cross-seam interactions and experience qualities that checklists cannot see.

## File format (`NN-module.yaml`)

```yaml
module: example
# `touches` is filled by the WALKER (design-side), not the author:
touches:
  tables: []
  ports: []
  routes: []
scenarios:
  - id: EX-S1
    name: Concrete name
    persona: admin            # admin | user | anonymous | …
    steps: |
      1. <concrete action with concrete values — never "configure X">
      2. ...
    success_signals:
      - <observable outcome a reviewer can screenshot/query/assert>
      - "EXPERIENCE: <what the user watches happen — no reload, instant, …>"
```

## Authoring rules

1. **Concrete values, always.** "Set close date 2027-04-30", not "set a close date."
2. **Every scenario carries ≥1 EXPERIENCE signal.**
3. **Assume real scale.** If a step involves a list, a signal must say how it behaves at that scale.
4. **Unhappy paths are steps, not footnotes.**
5. Scenarios may reference each other's outputs — state the dependency explicitly.

## Walker rules

For EVERY step, produce the **concrete artifact** that serves it — the actual SQL, the actual route path, the actual payload. Naming the mechanism is NOT a walk. Output: the filled `touches:` header + a gap list (step → what's missing → severity). File gaps in `GAP-REGISTER.md`.
