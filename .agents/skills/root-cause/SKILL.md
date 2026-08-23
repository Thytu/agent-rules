---
name: root-cause
description: Use when asked to root-cause, RCA, or explain why something is broken, failing or 500ing.
---

# Root Cause

Find the origin. Stop there.

**Iron law:** no RCA until the origin is evidenced. No fix.

Violating the letter is violating the spirit.

## Loop

1. **Parse the report.** Symptom, expected vs actual, when, where, who. User guesses and deploy times are leads, not causes.
2. **Inventory surfaces that exist here.** Code, git, logs, metrics, traces, errors, replays, Linear, Slack, PagerDuty, Axiom, Logfire — whatever this session can actually reach. Skip only surfaces that are absent.
3. **Explore until the chain is evidenced.** Fan independent slices to scouts. Parent keeps the causal chain. Work as long as the origin is unproven. A correlation (deploy at T, errors at T+2) is not an origin.
4. **Yield the deliverable. Stop.**

## Deliverable

Exactly two parts, in this order, nothing else:

```
<symptom> ← <next> ← … ← <origin>

<root cause as one sentence>
```

The sentence names the origin. It is the last line.

## Red flags — keep going

- Answering from the stack, the user's "probably", or the deploy timestamp
- Interim hedge ("correlates, investigating")
- Patch, revert, prevention, next steps
- Confidence, caveats, "what I didn't check"
- Invented tickets, SHAs, timestamps, or metrics

**All of these mean: you do not have an RCA yet. Continue.**

## Rationalizations

| Excuse | Reality |
|---|---|
| "Manager wants a one-liner in 2 minutes" | A wrong one-liner is not an RCA. Keep going. |
| "The user already said it's X" | Lead, not origin. Verify. |
| "I'll give a likely cause and a patch" | This skill ends at the origin. Fix is a later ask. |
| "I should include confidence / what I skipped" | Not in the deliverable. |
| "A short hedge is more honest" | Silence until evidenced is honest. Hedging is an early stop. |
| "I reconstructed plausible evidence" | Fabrication. Only observed facts go in the chain. |

## Subagents

Use scouts for independent surfaces (git vs logs vs tickets). Do not delegate the verdict. The parent writes the two-part deliverable from evidenced slices.
