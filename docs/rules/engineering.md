# Engineering conventions — how code is written here

House conventions only. Mandatory platform rules live in [`tech-stack.md`](tech-stack.md) — read that first; nothing there is restated here.

## The pattern to copy [lint-assisted]

Pick one full feature slice as the **golden path** and name it here (`REPLACE_ME`). Copy its whole shape:

self-authenticate → parse input at the edge through the schema (`min(1)` so required strings cannot be blank) → server-derive tenant fields, never trust client ids → write → typed field errors OR redirect; never leak raw errors → typed UI → error boundary. Both halves instrument. The view composes design primitives exclusively. Its functional oracle is a test named after the surface.

## Design system — routes compose, primitives construct

Every visual decision — color, border, radius, shadow, typography, motion — lives in the primitive layer and the token file. Routes speak layout only. A new primitive is an integration-owner request, same as a new column (`scripts/guard-shared.sh`). Never build a one-off in a route; never fork a primitive.

**Reviewer obligation:** *"could the whole look change by editing primitives + tokens only, with zero route diffs?"* Any "no" names the violation.

## Auth

Every loader AND action self-authenticates. Do not rely on a parent layout: a client can run a child loader alone. A genuinely public mutation opts out with an explicit marker.

## Current tenant

Never "first row in the table." Call the current-tenant helper and scope every query to it.

## Double-submit hygiene

Every mutating control disables while a request is in flight, and every genuinely duplicating action is idempotent server-side. The client guard is UX only.

## Bounded loaders

Every relational query selects only the columns its projection renders. Every list that grows per user action is capped or paginated with an honest truncation signal — a true count, a "showing first N of M" row, or a show-all link. Never a silently clipped table.

## No shortcuts — build it right, or raise it [lint-enforced: `no-deferral-comments`]

Never decide "later" in code. If the correct implementation exceeds your task, that is a **scope decision**, and you have no authority to make one — escalate it. It becomes a SCOPE / register row or it gets built now. Everything you merge is the production version of itself.

- The disease is not cutting scope — it is inventing a tier. "For now", "just for the demo", "v0, we'll clean it up later" are scope decisions recorded nowhere.
- A legal deferral leaves no trace in code. The record lives in SCOPE; the unbuilt path **throws**. It never silently degrades.
- **Reviewer obligation:** *"what here would be built differently with more time?"* Any answer = build it now, or it goes to the owner as a scope row **before** merge.

## No legacy — always move forward clean [lint-enforced: `no-compat-shims`]

There is no "backward" inside this repo. This is an application, not a library — every caller is in this codebase, so change the thing, **update every caller in the same change**, **migrate data forward** (never a tolerant dual-format reader), and **delete the old path**. No shims, no re-export aliases, no `@deprecated`, no parallel `V2`.

Compatibility exists only at boundaries we don't control, where it is an owner-decided feature with a spec.

**Reviewer obligation:** *"does this change leave two ways to do the same thing?"* If yes, one of them dies before merge.

## Shape at the boundary [lint-enforced: `no-runtime-typeof`, `no-generic-instanceof`, `no-loose-variant-objects`]

A value's shape is settled where it enters the program, never re-litigated downstream. `typeof x === "string"` deep in domain logic is a confession that nobody upstream knew what they were holding.

1. **Data from outside the program** is parsed once at the edge. Everything below receives a typed value.
2. **A value the program itself produces in more than one shape** is modeled: a discriminated union, an overload, or a narrower parameter type.

`Array.isArray` is the sanctioned array check (`instanceof Array` is not). An object schema pairing an enum with several optional siblings is a discriminated union that hasn't admitted it yet.

## Tests — every test must be able to catch a regression [lint-enforced: `meaningful-tests`]

A test earns its place only by pinning a contract the code could plausibly violate later, with its expected value stated independently of the implementation — from the spec, the scenario, the bug, or the boundary, **never read off the code under test**.

The litmus (reviewer agents MUST answer all three for every new test):

1. **Could it fail while the code is correct?** If routine intentional edits break it, it's a tax.
2. **Could it pass while the behavior is broken?** If every collaborator is mocked and the assertions restate the wiring, it proves nothing.
3. **Where did the expected value come from?** "From reading the code under test" = tautology.

When to write: a bug fix ships with the regression test that fails without the fix; real branching/boundaries get unit tests; persistence-as-contract gets integration tests against the real local DB. **No test** for pass-through wiring, UI copy, trivial mappers, or anything the type system already guarantees.

Where: all tests live in `test/`, named `<surface>.test.ts` — never colocated under `app/`. Nested worktrees are excluded from discovery.

Hermeticity: blank every local secret before the suite runs so a developer key cannot flip tests onto live providers.

Assertions: every test asserts at least one **observable outcome**. Mock-call assertions may corroborate, never stand alone. Mock only at **process boundaries**; never mock a sibling app module.

Anti-patterns (delete on sight): pass-through tautology · mock theater · re-derived oracle · copy/prompt literal · snapshot-as-coverage.

## Comments — write fewer, smaller, on the first try [lint-enforced: `no-citation-comments`, `no-long-comments`]

The default is **no comment**. Write one only when it carries a non-obvious WHY. If you delete it, would the next reader **misunderstand** the code? If no, don't write it.

Never write: WHAT the code does; change narration; **references to SCOPE tiers, rubric IDs, GAP-REGISTER rows, plans, or tickets** — state the constraint directly; restatements of the obvious; multi-paragraph essays (4 lines is the ceiling; a run of consecutive `//` lines counts as one comment). Schema and port files are NOT exempt.
