---
name: autopilot
description: "Orchestrates a task in a worktree through investigation, planning, judge review, implementation, and verification, with reproduction and root-cause analysis when needed. Use when the user invokes /autopilot."
---

# Autopilot

Own the complete outcome. Continue until the requested result is observed, the requested read-only deliverable is evidenced, or a prerequisite is genuinely unreachable.

## Invariants

1. The objective and its proof are defined before investigation or execution.
2. Every Git-backed run has a unique branch, worktree, run ID, and untracked state file.
3. The main agent is the sole writer. Isolated agents investigate, reproduce, plan, or judge; they do not edit the run worktree.
4. Reproduction and root-cause analysis are separate phases with separate deliverables.
5. `root-cause` is used only for unexplained incorrect behavior and always runs in an isolated agent because its contract ends after proving the origin.
6. A state-changing plan is judged before execution. A resulting repository diff is judged again before final verification.
7. Judge findings are inputs, not commands. The main agent records an explicit adopt/discard disposition with a reason for every finding.
8. Final verification exercises the requested outcome at its real surface. Compilation and unit tests alone are not completion proof.
9. A failed smoke or final verification is already reproduction evidence. Send it directly to a fresh isolated RCA phase, then re-plan.
10. Worktrees isolate files, not ports, databases, deployments, or external services. Shared resources require unique namespaces or a cross-run lock.
11. Never merge, deploy, mutate shared data, delete a worktree, or perform another destructive or irreversible action without the approval required by the repository and user.
12. Load and follow every task-specific skill and repository rule reached by the work. This skill orchestrates them; it does not replace them.

## Run artifacts

Inside the dedicated worktree, the main agent owns:

```text
.autopilot/
  state.md
  artifacts/
    reproduction.md
    root-cause.md
    evidence.md
    plan.md
    plan-judge.md
    plan-dispositions.md
    diff-judge.md
    diff-dispositions.md
    verification.md
```

These files are generated run state. Keep `.autopilot/` untracked through the repository-local Git exclude; do not change the tracked `.gitignore` solely for Autopilot state. Do not store secrets, full logs, or large diffs in `state.md`; put them in an artifact or reference their existing location.

Only the main agent writes run artifacts. Isolated agents return results to the main agent, which records them.

## Phase 0 — Define the contract

From the invocation and available context, write:

- one immutable objective sentence;
- the intended user or system outcome;
- observable success proof;
- scope and explicit non-goals;
- expected versus actual behavior when something is wrong;
- affected surface: browser, API, CLI, workflow, database, documentation, infrastructure, or external system;
- destructive or irreversible boundaries.

Ask only when materially different outcomes remain possible. Discover repository and runtime facts instead of asking for them.

A materially changed objective starts a new run. A clarification that preserves the outcome updates the current run.

## Phase 1 — Isolate or resume the run

For a Git-backed task:

1. If the current directory already belongs to an Autopilot worktree whose `.autopilot/state.md` has the same objective, resume it.
2. Otherwise allocate a unique run ID and create:
   - branch `autopilot/<task-slug>-<run-id>`;
   - a unique sibling worktree outside the source checkout;
   - `.autopilot/state.md` from `skill://autopilot/templates/state.md`.
3. Use the invoking checkout's `HEAD` as the base unless the invocation names another commit or branch.
4. Record run ID, base commit, branch, and absolute worktree path in state.
5. Ensure `.autopilot/` is covered by the repository-local Git exclude.
6. Set every subsequent file, Git, runtime, and subagent operation to the dedicated worktree.

Never silently copy, commit, reset, stash, or discard uncommitted changes from the invoking checkout. If the task depends on them, record the blocker and obtain an explicit base or snapshot decision.

For a non-Git task, allocate a unique run directory and state file. This isolates only local artifacts; external resources still require locks.

Do not automatically remove the worktree or branch at completion. Report both for integration and later cleanup.

## State discipline

Read `.autopilot/state.md` before every phase and after every resumed session. Update it after every phase transition.

- Keep `# Objective` as the first section and immutable.
- Replace current status; do not append a conversational diary.
- Separate verified facts from unknowns and hypotheses.
- Keep exactly one next action.
- Record artifact paths instead of duplicating long output.
- Record blockers only when the prerequisite is unreachable through available tools.
- Treat current code, runtime evidence, external state, and user instructions as authoritative over stale state.

Cold judge agents never receive or read `state.md`, prior judge output, or disposition history.

## Phase 2 — Route by required work

Do not force the task into bug, feature, or refactor labels. Answer these questions:

### Is there unexplained incorrect behavior?

- **Yes:** run the reproduction phase, then the RCA phase.
- **No:** inspect how the relevant system works now and record the facts needed to complete the requested outcome. Do not invent a cause.

### Does completing the task require making a persistent change?

Persistent changes include code, tests, configuration, documentation, data, deployments, tickets, dashboards, messages, and external resources.

- **No:** verify the evidence and deliver the read-only investigation, analysis, review, explanation, or decision. Do not manufacture implementation work.
- **Yes:** continue to planning.

### Is any step destructive or irreversible?

Record the boundary now. Request approval immediately before that step, after the plan has converged. Continue all safe work before the boundary.

## Phase 3 — Reproduce

Spawn one isolated general-purpose agent. It is read-only with respect to repository and external state except for safe runtime interaction required to observe the failure.

Give it:

- objective and expected versus actual behavior;
- reporter-provided steps and evidence;
- exact worktree path;
- relevant environment and surface;
- instruction to establish the smallest repeatable failing scenario without diagnosing or fixing it.

Require this output:

```text
REPRODUCTION: reproduced | not_reproduced
TRIGGER: exact steps, request, command, or input
ENVIRONMENT: relevant runtime state
EXPECTED: observable expected result
ACTUAL: observable actual result
EVIDENCE: exact output, response, screenshot, trace, log, or artifact path
ATTEMPTS: what was tried when not reproduced
```

A user-reported failure is ground truth. Reproduction establishes a reusable scenario; it is not a credibility check. When reproduction is impossible, preserve the attempt and proceed to RCA with available observed logs, traces, errors, data, or user evidence.

The main agent writes the result to `.autopilot/artifacts/reproduction.md` and updates state. The reproduction agent makes no causal claim and writes no fix.

## Phase 4 — Root cause

Spawn a separate isolated general-purpose agent. Tell it to:

1. read and follow `skill://root-cause`;
2. use the objective, reproduction artifact, and other observed evidence;
3. treat every supplied diagnosis or suspicion as a lead to verify;
4. work read-only in the exact run worktree;
5. own the causal verdict and use scouts for independent evidence surfaces when useful;
6. return only the `root-cause` skill's required deliverable.

The main agent writes the result to `.autopilot/artifacts/root-cause.md`. Do not plan or implement a fix until the origin is evidenced.

Reproduction answers **how to make the failure happen**. RCA answers **why it happens**. Never merge these responsibilities.

## Phase 5 — Build the evidence packet

The main agent writes `.autopilot/artifacts/evidence.md` containing:

1. objective and success proof;
2. current observed behavior or state;
3. reproduction evidence when applicable;
4. evidenced root cause when applicable;
5. relevant files, symbols, callers, runtime resources, and existing conventions;
6. constraints, invariants, and non-goals;
7. required task-specific skills and governance documents;
8. destructive boundaries;
9. exact smoke and final-verification surfaces.

This packet is evidence, not a substitute for reading current code. Every downstream agent must verify repository claims before relying on them.

## Phase 6 — Plan

Spawn one isolated `sol` plan agent. It may read the evidence packet and the run worktree but must not edit either.

Require it to produce `.autopilot/artifacts/plan.md` through the main agent with:

- intent and user outcome;
- exact files and symbols;
- affected callers and required clean cutovers;
- ordered vertical implementation slices;
- behavior and data invariants;
- test decision and named observable seam;
- task-specific skills and generated-artifact steps;
- destructive actions and approval boundary;
- smoke procedure;
- final end-to-end verification procedure;
- cleanup;
- risks and explicit non-goals.

No placeholders, speculative abstractions, compatibility shims, deprecated paths, or deferred follow-up work.

Resume the same plan agent when adopted judge findings require plan revisions. Do not expose prior judge history to fresh judges.

## Phase 7 — Judge the plan

Read and follow `skill://judge-loop` exactly.

Create a clean judge artifact at `.autopilot/artifacts/plan-judge.md` containing only:

1. **Intent** — the objective and user outcome.
2. **The work** — the complete current plan.

For every round:

- spawn three fresh isolated `judge` agents: architecture, governance, simplicity;
- give them only the clean judge artifact and their charter;
- never give them `state.md`, prior findings, or dispositions;
- have the main agent record every finding and adopt/discard reason in `.autopilot/artifacts/plan-dispositions.md`;
- send adopted findings to the plan agent for a complete class-wide revision;
- regenerate the clean judge artifact and run a fresh round after adopting blocking or strong findings.

Stop only under the `judge-loop` convergence rules.

## Phase 8 — Execute

The main agent implements the converged plan in the dedicated worktree.

Before editing each slice:

- read all matching task-specific skills and repository rules;
- inspect the current implementation and existing pattern;
- resolve exported-symbol callsites with language-server references when available;
- update state with the active slice and one next action.

Work in vertical slices. Preserve user work. Perform clean cutovers and remove obsolete paths. Do not suppress symptoms or special-case the reproduced input.

Automated tests are governed by `skill://test-authoring`. Bug fixes require the regression test mandated there. Tests support the behavioral proof; they do not replace it.

Immediately before a destructive or irreversible step, request the required approval. Do not ask earlier when safe work remains.

## Phase 9 — Smoke and cleanup

Run the smallest real scenario that exercises the requested outcome.

- If it fails, that failed smoke is reproduction evidence. Save it, spawn a fresh isolated RCA agent, rebuild the evidence packet, re-plan, re-judge, and execute again.
- If it passes, perform required cleanup: applicable tests, generated artifacts, docs, changelog, scaffold removal, and comment trimming.

Cleanup occurs before diff judgment and final verification so no unreviewed or unverified change follows the final proof.

## Phase 10 — Judge the diff

When the worktree has a repository diff, read and follow `skill://judge-loop` again.

Before every round, regenerate `.autopilot/artifacts/diff-judge.md` with only:

1. **Intent** — the immutable objective and user outcome.
2. **The work** — the complete current diff relative to the recorded base, including committed, staged, and unstaged changes.

Use three fresh isolated `judge` agents per round. The main agent records every disposition in `.autopilot/artifacts/diff-dispositions.md`.

Adopted findings return to execution, then smoke, cleanup, and a fresh diff-judge round. Discarded findings require an evidence-based reason. Stop only under the `judge-loop` convergence rules.

For a state-changing task with no repository diff, the converged pre-execution plan is the independent review gate. Continue to actual-state verification.

## Phase 11 — Verify the requested outcome

Verify the proof defined in Phase 0 against the final state after all cleanup and judge adoptions.

Use the real surface:

- web UI → drive the browser through the user flow;
- API → make the real request and inspect response and resulting state;
- CLI/TUI → launch and interact with the actual program;
- persistence or migration → exercise the owning seam and inspect data invariants;
- configuration or dependency change → start the real system and exercise affected behavior;
- documentation → render it and check links and factual claims;
- performance → repeat the same baseline measurement under the same conditions;
- security → exercise the attack, denied path, or enforced invariant;
- data analysis → cross-check definitions, totals, boundaries, and representative samples;
- external operation → inspect the resulting resource and its health signal.

Load `skill://verification` when the task is a full application flow. Load any more specific verification skill required by the surface.

If final verification fails, save the exact failure to `.autopilot/artifacts/verification.md`, spawn a fresh isolated RCA agent with that evidence, rebuild the evidence packet, and loop through planning again. Do not patch around the failing input.

## Shared-resource locking

Before starting a server, mutating an external resource, using a fixed test database, or entering another non-isolated surface:

1. derive a stable resource name;
2. acquire a run-owned lock under the repository's common Git directory;
3. record the lock and owner run ID in state;
4. keep unrelated phases parallel while waiting;
5. release the lock immediately after the shared phase;
6. never break another run's live lock without proving its owner is gone.

Prefer unique ports, process names, temporary directories, database/schema names, and preview environments over serialization.

## Completion

A state-changing run is complete only when:

- the plan judge loop converged;
- implementation and cleanup are complete;
- the diff judge loop converged when a diff exists;
- the requested outcome was observed at the real surface;
- required automated tests and generated artifacts are current;
- state contains no remaining action or reachable blocker.

A read-only run is complete when its requested result is corroborated by evidence.

Write `.autopilot/artifacts/verification.md`, mark state `complete`, and report:

- outcome first;
- exact verification evidence;
- root cause when applicable;
- resulting changes;
- plan and diff judge dispositions;
- branch and worktree;
- any external action performed;
- anything not verified, without implying completion.

Do not merge or delete the branch/worktree automatically.
