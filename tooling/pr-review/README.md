# PR review — autonomous rule owners

The source reviewer runs exactly eight independent owner reviews, one per top-level `docs/rules/*.md` owner. Each owns the whole pull request under its assigned document. A retryable transport drop may open one fresh provider session, but it keeps the owner’s original deadline, tool budget, and already-proven findings. Generated repositories receive the rule documents as coding guidance but no reviewer runtime or workflow.

## Architecture

- `agents.mjs` discovers and sorts the eight top-level rule documents and fails if the count differs from the declared budget. There are no profile reviewers or marker stubs.
- `core.mjs` loads each document verbatim and configures Pi's native DeepSeek
  provider for `deepseek-v4-flash`. `FINDING_LIMITS` bounds what reaches GitHub;
  oversized tool arguments are clamped at submission. Requests use the model
  catalog's explicit `maxTokens` ceiling rather than a smaller derived token
  budget, so a valid multi-tool response is not truncated. Cost is bounded by
  the shared 15-minute deadline, 60-turn and 200-tool ceilings, and at most
  `SUBMISSIONS_PER_RESPONSE` recorded findings per response—not by a separate
  `RESPONSE_CEILING`.

- `agent.mjs` gives each rule owner its own `@earendil-works/pi-agent-core`
  `Agent`. Its initial context is a compact changed-file index (status, path,
  rename, and line counts), never concatenated diffs. Pi owns the persistent
  conversation, provider streaming, validated tool execution, and continuation;
  the model controls investigation order and breadth. Findings are submitted one
  per `submit_finding` tool call as the reviewer proves them, so the number of
  findings never bounds what a session can report.
- `repository.mjs` exposes read-only, paginated tools for changed-file diffs,
  changed or unchanged file contents at base/head, literal repository search,
  and tracked-path listing. Git is invoked with argument arrays and paths must be
  repository-relative.
- `ci-review.mjs` launches the rule-owner sessions in parallel and passes their
  findings into the existing deterministic posting pipeline in `inline.mjs`.

The reviewer creates eight top-level whole-PR owner reviews, never one review per changed file. All eight run in one parallel wave. A ninth document fails before model use until the owner and cost contract is changed explicitly.

The launcher does not rank files, create clusters, prescribe traversal order, or
encode a delegation workflow. Its only orchestration is independent rule-owner
parallelism and safety limits.

## Incremental submission

A reviewer reports each violation with a `submit_finding` call the moment it is
sure of it, one finding per call, and closes the session with a `finish_review`
call carrying only the running total. No response therefore grows with the size of
the review. It exists because the original contract made one terminal JSON carry
every finding, so a reviewer with a lot to say about a large diff was cut off
mid-answer and its whole review was discarded.

The truncation that forced this was our own bug, not a provider limit. pi-ai sends
`max_completion_tokens` for OpenAI-compatible providers outside its allow-list,
DeepSeek is outside it, and DeepSeek's API reads only `max_tokens` — so every
ceiling we sent was dropped and DeepSeek's 8192 default stood in for it.
Requesting 6214 and still stopping at 8192 is what exposed it. The runtime now
names the field DeepSeek reads and asks for the catalog's own ceiling.

Every request sets `toolChoice: "required"`, so a response can only be tool calls.
Incremental submission alone did not fix the overflow — reviewers still spent whole
whole responses on commentary, one of them reaching the cap by its fifth turn
without ever submitting a finding. Prose was never read by anything; now there is
no channel for it, which is enforcement rather than instruction.

`submit_finding` is the validation boundary. Pi checks the arguments against the
finding schema before the tool runs, so a malformed submission comes back as an
error the reviewer can act on. Beyond the schema, submissions are refused — never
silently accepted, never fatal — when they cite a file the pull request does not
change, when they exceed `SUBMISSIONS_PER_RESPONSE` in one response, in which
case the reviewer is told to re-issue them next turn, or when the submission
clears its own subject instead of reporting a violation.

That last one is a refusal because prompting did not stop it. Three prompts say a
file you inspected and cleared is not part of the review, and reviewers still
submitted their checklists — "no shadcn import; no violation", "this is copy, not
a visual decision; no design-system violation is established" — as inline
comments telling a human nothing was wrong. It happens on sessions that close
voluntarily, so it is not an artifact of the close ask. The guard matches only a
*trailing* clearance clause, which is what separates a reviewer clearing its
subject from a real finding that argues through a negation on its way to a
consequence ("the loader has no limit, so no cap violation is caught before a
large event times the page out" is a finding). It is validated against the
clearances and the findings a production run actually produced, and like every
refusal here the reviewer is told why and keeps what it already proved. An exact repeat of an
already-banked finding is answered `duplicate: true` and does not change the total;
near-duplicates remain `inline.mjs`'s job, since it merges across rule owners with
evidence this boundary does not have. Every result carries the authoritative
running total, which is what the terminal `submitted` count is checked against.

A finding whose fields exceed `FINDING_LIMITS` is trimmed at that boundary, never
rejected: a real violation stated too verbosely is still a real violation, and
dropping it would delete signal to enforce a budget. `quote` is trimmed bare, since
anchoring tests whether the cited changed line contains it; `rule` and `why` only
render as prose and are elided.

## Completion semantics

A session is complete only after `finish_review` is called, its arguments pass a
TypeBox schema at the boundary — no hand-rolled shape checks — and its `submitted`
count equals what actually reached the bank. A dropped SSE stream (`terminated`,
`other side closed`) is retried once on a fresh session using only the time left
inside the owner's single 15-minute deadline. Provider errors, timeouts, aborted
runs, exhausted budgets, a session that never closes, a second dropped stream,
and a count that disagrees with the bank are **incomplete**, never clean.
The close is read off the tool call
and ends the session there, so closing never depends on when a tool result is
appended relative to the turn hook.

Because a response can only be tool calls, a reviewer cannot stop by saying it is
done — it stops by calling `finish_review` or not at all. Reaching the turn budget
is therefore treated as the moment to ask for the close, not the moment to give up
on it: the session gets one explicit "investigation is over" ask with a small extra
turn allowance, told what is already banked so it does not resubmit.

The close ask also names the per-response allowance, because the failing sessions
submitted one finding per turn: each banked exactly as many findings as it had
closing turns. At one per response the drip rate, not the review, decides how much
survives, so the ask says how many `submit_finding` calls one response may carry
and that anything unsent when the allowance ends is lost.

Asking is not enough on its own. On a 25-file pull request four of five sessions
spent that whole allowance submitting more findings and never closed, so reviews
that had already done the work were reported incomplete — asking loses to a
reviewer that always has one more finding. So the allowance ends in turns whose
toolset holds nothing but `finish_review`. Forced tool choice over a one-tool set
leaves the close as the only call a response can make, which is enforcement rather
than instruction, and it costs the review nothing: every finding submitted up to
that point is already banked.

A close reached that way is a weaker claim than a volunteered one — the reviewer
never said it was finished, it ran out of anything else to do — so the run log
marks it `forced` and a session that closed on its own stays silent about it.
What the forced close still asserts is the count: the reviewer has to state a
total that matches the bank, and a reviewer that has lost track of its own review
cannot. A session that will not close even then is incomplete, with its banked
findings posted.

A response that does not close the review earns **exactly one re-ask** before the
session is called incomplete. The re-ask names the closing call and tells the
reviewer its banked findings are already recorded, so it must not send them
again. This is a
recovery, not a second chance at the contract: the turn, tool-call, and wall-time
budgets are shared with the first ask, a reviewer that misses twice is incomplete,
and the reason reported is the second failure. It exists because a reviewer that
ends in reasoning has said neither “I finished” nor “I stopped”, and one extra
turn recovers that review instead of discarding it. A session that needed the
extra ask says so in the run log as `reasked=N`, and a session that did not stays
silent about it — otherwise there is no way to tell whether the recovery ever
fires against a real reviewer or is only exercised by its tests.

A truncated answer (`stopReason: "length"`) stays incomplete and additionally
reports the output tokens the provider says it produced, how many were reasoning,
and the ceiling the request actually asked for — enough to tell an oversized answer
from a provider ceiling below the one we sent. A session that stops normally without
the contracted signal reports the block types, text length, and opening of what did
arrive, which separates narrating instead of answering from answering with reasoning
only or with nothing.

**A session that dies mid-review still posts what it banked.** Those findings were
proved before the failure, and discarding them buys no safety: the session is still
reported incomplete, so it is named in the summary, it fails the required AI-review
check, all stale-thread resolution is deferred, and zero findings still cannot render
as “no issues found”. Only real review would be lost. What an incomplete session can
never do is assert that the pull request is clean.

## Deterministic posting

Findings land as one advisory GitHub review (`event: COMMENT`), with one thread per
anchored finding.

- **Anchoring:** the agent supplies an absolute new-file line and exact quote.
  The line is accepted only when that quote matches an added diff line. Existing
  quote and snippet-map fallbacks remain for compatibility; unanchorable findings
  become file-level comments.
- **Fallbacks:** file-level failure demotes to the review body; rejected inline
  reviews retry with body findings; a second review failure falls back to the
  summary comment. Findings are not silently dropped.
- **Identity and dedupe:** stable markers fingerprint file plus normalized rule
  concept, excluding line and reviewer identity. Exact or conservative fuzzy
  matches suppress repeat posts, including human-resolved threads.
- **Reconciliation:** a vanished finding gets one resolved reply and a
  best-effort GraphQL thread resolution only after a complete review. Bot-resolved
  findings that reappear post fresh.

The GitHub Actions job uses base-owned `pull_request_target` code. It checks out the exact base SHA, fetches `refs/pull/<number>/head` as an object without checking it out, verifies the event head SHA, and exposes head content only through bounded read-only repository tools. Candidate workflow/code never receives the DeepSeek secret or write token; validated output can post advisory review comments only.

## Verification

All local reviewer tests are network-free:

```bash
node --test test/pr-review/*.test.mjs
```

They cover the exact eight-owner budget and one-wave launch over a 240-file index,
multi-turn changed and unchanged reads, Git-backed repository access and path
safety, provider/tool/budget failure states, a retry sharing the original owner
deadline, truncation and unparseable-answer diagnostics, finding-budget
enforcement, incremental submission, completion signaling, anchoring,
fingerprints, dedupe, reconciliation, stale deferral, and posting payloads. CI
runs this complete network-free set in its unconditional quality job.

A local production dry run performs real DeepSeek sessions but no GitHub writes:

```bash
DEEPSEEK_API_KEY=... DRY_RUN=1 \
  BASE_SHA=<base> HEAD_SHA=<head> node tooling/pr-review/ci-review.mjs
```

Supplying `GH_TOKEN`, `REPO`, and `PR_NUMBER` additionally previews reconciliation
against existing comments using read-only GitHub calls.

## Evaluation

`review.mjs` now evaluates the production autonomous-agent boundary. Each fixture
is exposed as a one-file pull request with the same repository tools, every rule
owner gets its own session, and any incomplete session aborts the run rather than
being scored as a clean prediction.

```bash
DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=deepseek-v4-flash \
  RUNS=5 node tooling/pr-review/review.mjs holdout
DEEPSEEK_API_KEY=... node tooling/pr-review/review.mjs dev
```

The evaluator prints micro and per-owner precision, recall, and F1. Development
cases are available while tuning; holdout cases remain separate to expose
overfitting. Results are a baseline only when every owner completes.

The committed corpus has 36 development and 43 holdout fixtures. With eight owners, one run performs 288 and 344 owner evaluations respectively, or 632 for both. A retryable transport drop can add at most one provider session to an owner evaluation without resetting its limits.
