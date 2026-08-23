---
name: judge-loop
description: Use when a plan, diff, or PR direction needs independent challenge before implementation or submission; for judge loop, run the judges, or pre-PR convergence.
---

# Judge Loop

Converge on the cleanest version of a plan or diff by running three cold,
independent judges each round: architecture, governance, simplicity. Judges
are data points, not authorities. You weigh their findings, adopt or discard
each one explicitly, and iterate until the direction survives fresh scrutiny.

This skill is self-contained: the three judge charters live in `judges/`
next to this file. It does not require any other skill to be installed.
Charters tell judges to read repo governance docs (`AGENTS.md`,
`STRATEGY.md`, `REVIEW.md`) when they exist and to proceed without them
when they don't.

## The artifact

Judges never see the conversation. Before round one, serialize the work
into a single artifact file (scratchpad or temp path) containing:

1. **Intent** — one paragraph: what this change is supposed to do, for whom.
2. **The work** — the full plan, or the full diff (`git diff <base>...HEAD`
   output pasted in; do not make judges guess the base).

The artifact is the assignment: it names the intent and the change.
Judging that assignment means following the changed symbols through the
repo — their unchanged callees and callers — until each claimed behavior
has a concrete path. Update this artifact as you adopt findings. Never
add round history, previous findings, or dispositions to it.

## Running a round

Spawn three subagents in parallel, one per charter in `judges/`. Fresh
agents every round: no conversation history, never forks, never a reused
judge.

**Type, in this order:**

1. If this harness has a `judge` agent type, spawn `agent: "judge"`.
2. Else spawn general-purpose (`task`). Do not omit `agent` and hope.
3. **Never spawn `reviewer`.** That type is a PR reviewer on `@slow` →
   Grok. It is a different job.

After spawn, the widget must say `⟦judge⟧` (or `⟦task⟧` if `judge` is
absent). `⟦reviewer⟧` means you picked the wrong type — cancel and
respawn. Confirm the child `model_change` is the intended cheap model
before trusting the seats.

Each judge's prompt is exactly:

```
You are an independent judge. You have NO context about this work's
history or author.

1. Read <skill-dir>/judges/<charter>.md and adopt that charter fully.
2. Read the artifact at <artifact-path>. It is the assignment: the
   intent plus the change.
3. Follow the changed symbols through the repo. Unchanged callees and
   callers of the changed code are part of the assignment. Use git,
   read, and grep as the charter requires.
4. Return exactly this shape:
   VERDICT: approve | concerns
   FINDINGS: numbered; each = severity (blocking | strong | note),
   the issue, and why it matters. Omit if approving.

Do not rewrite the work. Do not pad. A few pointed findings beat a report.
```

## Disposition — after every round

For every finding from every judge, record one line in a disposition log
you keep outside the artifact:

| Finding | Decision | Reason |
| ------- | -------- | ------ |
| ...     | adopt    | ...    |
| ...     | discard  | ...    |

Adopt means you change the artifact now. Discard is legitimate — judges
lack context you have — but it requires a written reason, not a shrug.

## Convergence

- Any finding adopted → run another full round on the updated artifact.
- Stop when all three judges approve, or when every remaining finding is
  discarded with a recorded reason.

Final output: the converged artifact plus the disposition log. The log is
ready-made PR-description material for why the shape is what it is.

## Common mistakes

| Mistake | Fix |
| ------- | --- |
| Passing prior findings, chat history, or "the judges said" to a judge | A judge's assignment is the charter and the artifact. Prior rounds live in the disposition log. |
| Adopting everything to make judges approve | Every finding gets a deliberate adopt/discard with reason |
| Editing the artifact, declaring done without a fresh round | Adopted changes require re-judging |
| Reusing a judge agent or forking yourself as judge | Fresh `judge` (else `task`) each round |
| Spawning `reviewer` because the prompt said "reviewer" | `reviewer` is not a judge seat. Use `judge`. |

