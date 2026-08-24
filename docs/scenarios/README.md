# Generator scenario suite

Source scenarios exercise the materializer itself. `touches.files` records every changed generator/spec/policy path; tables, ports, and routes remain available for product repositories.

```yaml
module: materializer
touches:
  files: []
  tables: []
  ports: []
  routes: []
scenarios: []
```

Every step uses concrete inputs and every scenario carries an observable result plus an `EXPERIENCE:` signal. Changes to any named file re-walk every matching scenario. Gaps go in `GAP-REGISTER.md`.
