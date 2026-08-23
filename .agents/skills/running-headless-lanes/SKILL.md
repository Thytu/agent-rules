---
name: running-headless-lanes
description: Use when delegating autonomous multi-step work to a headless coding agent in the background — launching lanes, recovering one that stalled, exited early, asked a question, or shipped without a judge-loop adopt/discard log, or when the parent is about to run those judges itself.
---

# Running Headless Lanes

## Overview

A headless lane is a background agent process doing autonomous work, ideally in its own git worktree. The channel is **turn-based, not one-shot**: sessions resume by ID with full context. Durable state lives in the repo (commits, branches, PRs); the conversation lives in a session file on disk. `judge-loop` is part of the lane: the parent never absorbs those judges.

## Pick the harness by the model

| | `omp` (Oh My Pi) | `claude` (Claude Code) |
|---|---|---|
| Best for | **open / non-Anthropic models** — xAI, OpenAI, Groq, OpenRouter, gateways | Anthropic-native models |
| Model routing | first-class, provider-qualified (`ramp/grok-4.6`) or fuzzy (`grok-4.6`) | one model + env; non-Anthropic needs a gateway that speaks Messages API |
| Resume handle | recovered **after** launch (no stamp flag) | **stamped at launch** via `--session-id` |
| Hard stop | `--max-time 120m` | none — needs external watchdog |

Claude Code drives Anthropic models best; it is the weaker choice for open-weight models, which is what `omp` exists for. Reach for `omp` first when the lane runs on anything non-Anthropic.

## omp — launch

```bash
source ~/.zshrc              # `omp` is a shell FUNCTION, not just a binary
cd <worktree> && omp -p --model ramp/grok-4.6 --auto-approve \
  --max-time 120m --thinking high "<brief>" < /dev/null
```

Run as a background task, then capture the resume handle:

```bash
SLUG=$(echo "<worktree-abs-path>" | sed 's#/#-#g')   # dashes replace slashes
ls -t ~/.omp/agent/sessions/*"$SLUG"*/*.jsonl | head -1
# filename = <timestamp>_<uuid>.jsonl — the uuid IS the session id
```

- `--auto-approve` (or `--approval-mode=yolo`) is mandatory headless, or it waits forever on the first tool approval.
- `--max-time` is a real hard stop and the cheapest runaway insurance available. Use it.
- `--cwd <dir>` sets the workspace without a `cd`; `--add-dir` grants extra dirs.
- **Discovery is automatic**: `AGENTS.md` rules and skills load without flags (`--no-rules` / `--no-skills` opt out). Briefs may rely on the repo's own map.
- Read-only probe: `--no-tools --no-session`. Machine-readable output: `--mode json`. Ephemeral: `--no-session`.
- API keys come from provider env vars or omp's own config; a gateway's key lives in `~/.omp/agent/models.yml` under `providers.<name>.apiKey`.

## claude — launch

```bash
SID=$(uuidgen | tr 'A-Z' 'a-z'); echo "lane-x session: $SID"
cd <worktree> && \
  ANTHROPIC_BASE_URL=<gateway-origin> ANTHROPIC_AUTH_TOKEN=<key> \
  CLAUDE_CODE_MAX_CONTEXT_TOKENS=<model's real window> \
  CLAUDE_CODE_SUBAGENT_MODEL=<model> \
  CLAUDE_ENABLE_STREAM_WATCHDOG=1 CLAUDE_ENABLE_BYTE_WATCHDOG=1 \
  CLAUDE_STREAM_IDLE_TIMEOUT_MS=120000 CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS=120000 \
  API_FORCE_IDLE_TIMEOUT=1 CLAUDE_CODE_RETRY_WATCHDOG=1 \
  claude --model '<model>' --effort <tier> \
  --dangerously-skip-permissions --session-id "$SID" \
  -p "<brief>" < /dev/null
```

- Env names are exactly `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`, and the base URL must be the **origin** — the SDK appends `/v1/messages` itself. Drop both for native models.
- `--dangerously-skip-permissions` is mandatory headless.
- `CLAUDE_CODE_SUBAGENT_MODEL` pins the lane's *own* subagents; omit it and they silently run the expensive default.
- Set `CLAUDE_CODE_MAX_CONTEXT_TOKENS` for any model Claude Code does not recognize — it otherwise assumes 200k and compacts at the wrong point.
- The watchdog block self-heals silent SSE stalls (open connection, no bytes — common through gateways under load): abort after the idle window and retry instead of hanging forever. `CLAUDE_CODE_RETRY_WATCHDOG=1` is the documented unattended mode. Docs: code.claude.com/docs/en/network-config#streaming-idle-watchdogs.
- `--output-format stream-json --verbose` makes the output file a tailable live log; plain `-p` prints only the final message.

## The brief is the entire inbound channel

Same for both harnesses. Write it in these parts, in order:

1. **Identity + workplace** — lane name, worktree path, branch, what is already committed/uncommitted there and whether to preserve it.
2. **Unattended clause** — "You run FULLY UNATTENDED: never end your turn with a question or a narration of intent — decide and act. Your FINAL printed message MUST be the report described below."
3. **Orient before coding — the lane's job, never yours.** The lane reads the repo's agent map and the docs its task maps to, then establishes the CURRENT state of the code it is about to change, before writing anything. A lane that starts from the brief's description instead of the code re-implements what already exists, or fixes a symptom whose cause moved. Require it to name, in its report, what it found already in place.

   Put as much context in the brief as you have — symptom in the reporter's own words, who it hurts, what you already suspect, invariants, where you think the code lives. Context is a head start, and withholding it to keep the lane "unbiased" just makes it rediscover things slowly.

   **What context never does is discharge the duty.** Everything the brief asserts about the code is a **lead to verify, not a fact to build on**: the lane confirms it against the current code before relying on it, keeps looking after the first thing that fits your suspicion, and reports where the brief turned out to be stale or wrong. State that explicitly in the brief, because the default failure is the opposite — a lane trusts a written diagnosis over what it can see, stops searching the moment something matches, and inherits every finding that has gone stale since you wrote it. A brief that says "I suspect X; verify before you rely on it, and tell me if I was wrong" gets you both the head start and the independent look.
4. **Mission with every foreseeable fork pre-answered** — preserve-or-discard, naming, scope edges, what to do when tests fail. An unanswered fork becomes a stalled lane.
5. **Process bindings** — verify command, which shared/guarded files this branch may touch, and the review loop: name `judge-loop` as a required sub-skill the lane invokes on its own diff (cold independent judges per round, an explicit adopt/discard with a reason for every finding, re-judge after adopting). Do not write "review your work."
6. **Definition of done — not "PR opened"** — see below. The single most expensive omission.
7. **Report spec** — exactly what the final message must contain; it is the only packet coming back. Demand the honest-verification clause (what was checked live vs not, and what it deliberately left out) and a **judge-loop adopt/discard log** slot. A report without that log is unfinished, same as a report without a PR URL.

Split it into a reusable `common.md` (parts 2, 3, 5, 6, 7) plus a per-lane mission file, and pass `"$(cat common.md)\n\n$(cat laneN.md)"`. Only the mission is ever hand-written.

## Done means green, not submitted

A lane that opens a PR and exits has handed you a *coordination task*, not finished work — you inherit the polling, the red-CI diagnosis, and the review comments. Bind the lane to drive its own PR to done:

- **Every CI check passing.** Not "tests pass locally" — the pipeline, on the PR. A lane that stops at `pnpm verify` green has not seen the checks that only run in CI.
- **Red CI is the lane's job, not yours.** It fixes and pushes until green, or reports precisely why it cannot.
- **Judge-loop ran in the lane.** The report contains the adopt/discard log from `judge-loop` on that branch's diff. Missing log = unfinished. The parent does not write the artifact, spawn the judges, or absorb a user `judge-loop` invocation for a live or dead lane — resume the lane with that as the remaining work.
- **No unresolved review threads.** Every automated or human finding gets an explicit **adopt** (fixed, with the commit) or **dismiss** (reason posted as a reply). A reply is not enough: GitHub merge-blocking conversations stay open until `resolveReviewThread`. After each adopt/dismiss, resolve that thread via GraphQL (`reviewThreads(isResolved:false)` → `resolveReviewThread`). Re-query until unresolved count is 0. Silence is not a disposition.
- **Never merge.** Merging stays with the integration owner — that is the one thing the lane must not do, and it is *not* the same as stopping at "PR opened."

Because a `-p` session ends when it stops printing, a lane that must wait on CI has to poll inside its own turn (`gh pr checks --watch`, or a poll loop) rather than exiting and hoping. Say so explicitly, or it will exit the moment the PR exists.

## Talking to a lane

| Situation | omp | claude |
|---|---|---|
| Exited early with a question | `omp -p -r <id-prefix> --model <m> --auto-approve "<the answer>"` | `<same env as launch> claude -p --resume <sid> "<the answer>"` |
| Shipped without a judge-loop log | resume: run `judge-loop` on your diff; put the adopt/discard log in the report | same |
| Lost the session id | newest `.jsonl` in `~/.omp/agent/sessions/<cwd-slug>/` | newest `.jsonl` in `~/.claude/projects/<cwd-slug>/` |
| Continue last session in a dir | `omp -p -c "<msg>"` | resume by id |
| Branch instead of continue | — | add `--fork-session` |
| Unsure a flag exists | `omp --help` | `claude --help` — never guess flags |

Both resume by **id prefix** and preserve full context. Piping stdin answers (`echo yes |`) does nothing — the process already exited; no prompt is waiting. Relaunching fresh when a resume would do throws away everything the lane learned.

## Failure modes

| Symptom | Cause → fix |
|---|---|
| Exit 0 but work incomplete; last line is a question or "Doing X now." | model ended its turn; nobody can reply → resume with the answer; harden brief part 2 |
| No output, process alive but idle | missing `--auto-approve` / `--dangerously-skip-permissions`, or upstream auth expired → probe with a 1-line `-p "ping"` |
| Transcript frozen >15 min, process tree ~0% CPU, one ESTABLISHED-but-silent connection | upstream stream stall without the watchdog env → kill pid, resume with the block added |
| `402` / `401` from a gateway mid-lane | gateway credits or a dead key → probe with a 4-token curl before relaunching; check where the *live* key actually lives |
| Lane's subagents burning the wrong model | `CLAUDE_CODE_SUBAGENT_MODEL` unset at launch (claude), or `--smol`/`--slow` roles unset (omp) |
| Lane reports success; PR is red, or conversations still block merge | brief said "open a PR" / "post a dismiss reason" instead of green CI + **resolved** threads → resume; harden part 6 to require `resolveReviewThread` |
| Lane rebuilt something that already existed, or fixed a symptom | no orient-first requirement → brief part 3; make it report what it found already in place |
| Lane "reviewed its own work" and found nothing | "review your diff" invites self-approval → name `judge-loop` and require the adopt/discard log |
| Lane shipped; report has no adopt/discard log | missing done-gate → resume the lane; do not run the judges in the parent |
| User invoked `judge-loop` after the lane skipped it | invocation names the missing work, it does not move the seat → resume; parent-runs-judges is unfinished lane work |
| Parent starts a judge artifact or spawns architecture/governance/simplicity seats for a lane diff | absorbing the review → stop; resume the lane |
| "Background tasks still running after 600s; terminating" | lane left dev servers running — report may be truncated; trust the worktree/PR over the printed output |

## Red flags — stop and resume the lane

- Writing `/tmp/*judge*artifact*` (or any judge artifact) in the parent chat for a lane's diff
- Spawning architecture / governance / simplicity judges for work a lane already shipped
- "Faster to run the judges here — I already have the diff"
- "The lane died, I'll finish the review"
- "User invoked judge-loop, so I run it in this chat"

**All of these mean: resume the lane. Missing judge-loop is unfinished work, not a parent task.**

| Excuse | Reality |
|---|---|
| "User invoked judge-loop, so I run it here" | The invocation names the missing work. The seat is still the lane. Resume. |
| "I already have the diff; faster here" | Sunk cost. The worktree already has the commits. Parent-running-judges is the waste. |
| "The lane died; I'll finish the review" | Dead lane is a resume, not a takeover. |
| "Self-review / I read the diff counts" | Self-review is the failure `judge-loop` exists to prevent. |
| "The brief already named judge-loop" | Naming it in the brief without a done-gate is how the skip shipped. |

## Verify a new harness before trusting a lane to it

Four probes, in order, each one cheap: **(1)** print mode + tool use writes a known file; **(2)** resume by id recalls a fact from turn one; **(3)** the repo's `AGENTS.md` is in context (ask it to quote a distinctive phrase); **(4)** if the lane will judge images, send one real image and confirm input tokens rise *and* the description is accurate — gateways exist that accept image blocks and silently drop them, and a model that cannot see will confabulate rather than refuse.
