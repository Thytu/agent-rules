# Data access

## Review scope

Apply this owner to the Drizzle schema in `src/db/schema.ts` (the path `drizzle.config.ts` reads), migrations in `db/migrations/`, database adapters, and the contracts those adapters return. Authorization, external input validation, and deployment compatibility keep their own owners.

## Requirements

Give each stored fact one owner. Use Drizzle tables, columns, operators, joins, and partial selects for ordinary queries. A named `sql` template is appropriate for an operation the builder cannot express clearly, such as a constraint, a lock, or set-based ingestion; bind every runtime value through the template. `sql.raw()` is rejected by lint because it inserts text unescaped.

Drizzle's `sql<T>` declares a type, it does not decode one. Cast in SQL, or map and check the result, before returning a value whose driver type can differ, such as a large number or a date. Derive row types from typed selections; define a separate type only where data crosses a transport or feature boundary.

Every independently callable read and write is scoped to its tenant and authorized at the database operation. Bound every read that grows with users or data, and expose pagination or truncation honestly. When a screen combines several queries, decide whether it needs one consistent snapshot.

Keep list enrichment set-based: load related rows with a join or one `IN` query, never one query per row. Cover each list read with `test/helpers/query-budget.ts`, using small and growing fixtures, and assert the returned data as well as the query count.

Migrations are append-only once committed, because databases that already applied a migration never run an edited copy; `tooling/check-migrations.mjs` enforces this. Change the schema in `src/db/schema.ts`, generate a new migration with `pnpm db:generate`, and review the generated SQL. A migration that changes what existing rows mean backfills them, and its tests check new writes and old data against the same contract. Apply a migration that changes behavior to an isolated database during review, with representative rows, and record the result in the pull request. Measure a representative query plan before adding or changing an index for performance, and record the effect.
