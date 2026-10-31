# agent-rules

One-shot rules and tooling materializer for new repositories.

## Initialize a new repository

Create a repository from this GitHub template, then run `./init.sh` once, before adding files. In a terminal it asks which languages and add-ons to use, shows the plan, and asks for confirmation:

```bash
./init.sh
```

Agents and scripts pass the same choices as arguments:

```bash
./init.sh typescript
./init.sh python,typescript
./init.sh typescript --with nextjs,tailwind,database=postgresql
./init.sh typescript --with react,database=sqlite --dry-run
./init.sh --list
```

| Choice | Values |
|---|---|
| Languages | `python`, `rust`, `typescript`: one or more, in any order |
| Add-ons (`--with`) | `react`, `nextjs` (includes `react`), `tailwind`, `database=postgresql`, `database=sqlite` |

Every language brings formatting, lint, types, tests with whole-source coverage floors, and dependency audits. Every repository gets the commit gate, the push gate, secret scanning, file-size and duplication limits, and a flaky-test check on `main`. Add-ons add their own lint rules, rule documents, checks, and tests:

| Add-on | Adds |
|---|---|
| `react` | hooks, effect-cleanup, and accessibility lint as errors; `docs/rules/react.md` |
| `nextjs` | a minimal App Router app and its test, Next.js lint, typed routes, the production build in the push gate, client bundle budgets in CI; `docs/rules/nextjs.md` |
| `tailwind` | Tailwind CSS 4 with class-correctness and design-token lint; `docs/rules/tailwind.md` |
| `database` | a Drizzle ORM data layer for PostgreSQL or SQLite (including Cloudflare D1): append-only migrations, a raw-SQL ban, N+1 query budgets for tests; `docs/rules/data-access.md` |

`--dry-run` prints the plan, the gates, and every file that would be created, and says whether the repository is ready; it changes nothing. A mistyped language, add-on, or option is answered with the likely intended spelling, and a combination that cannot work is answered with a command that can.

Initialization copies a language-neutral core plus only the selected languages and add-ons, composes their configuration, prunes the committed add-on lockfile to the selection at its pinned versions, validates the complete output in a temporary directory, replaces the template payload with rollback protection, installs selected tooling, and removes the generator.

It intentionally rejects the canonical `Thytu/agent-rules` checkout, non-`main` branches, tracked changes, staged changes, and every untracked or ignored filesystem entry. It never adapts an existing application.

After initialization, commit the tree (the commit gate verifies it), push (the push gate runs the full verification), and run `bash scripts/setup-github.sh` to install repository settings, required checks, and vulnerability alerts without scheduled dependency-update pull requests.

## Repository workflow

History is append-only: fix forward; never amend, rebase, or force-push. Merge `main` into the branch when synchronization is required.

Everything lands by squash merge and the branch is deleted. The pull-request description is the decision record and preserves every relevant decision and user-visible outcome before merge.

## Develop the generator

```bash
bash scripts/setup-source.sh
pnpm verify
```

Add-ons live in `template/addons/<name>/`: an `addon.conf`, the files they add, JSON fragments merged into the TypeScript configuration, and the gate steps they add. A variant (`database@sqlite`) applies for one parameter value; a combination (`nextjs+tailwind`) applies when all its members are selected. After changing an add-on's dependencies, run `pnpm template:lock`; `pnpm verify` fails while the superset lockfile is stale or carries a high-severity advisory.

The source reviewer remains source-only. No generated repository receives model dependencies, credentials, or reviewer code.
