---
name: linter-optimization-ideas
description: Find and rank linter optimization hypotheses from stage timings and CPU or allocation profiles; use when asked for performance opportunities or a screened optimization backlog.
---

# Linter optimization ideas

Find concrete, distinct changes that could reduce linter wall time. Ground each idea in existing stage timings and profiler evidence. This skill creates an evidence-backed backlog; it does not implement candidates unless the user also asks for implementation. For throughput experiments, follow [`../linter-performance/SKILL.md`](../linter-performance/SKILL.md).

## Evidence first

- Identify the measured project, command, file scope, toolchain, baseline snapshot, load conditions, and whether the profile is for the same implementation. Prefer the latest compatible cold timing report and its matching CPU profile. Do not compare mismatched scopes or revisions as if they were one run.
- Read stage timers to locate expensive phases. Use a CPU profiler for computation and an appropriate wall-clock, allocation, or process/IO profiler when those costs are suspected. Treat profiler runs as attribution data; keep their overhead and results separate from unprofiled throughput measurements.
- If current evidence cannot distinguish a suspected cost, ask the coordinator to capture targeted timings or a profile using the existing performance workflow. Keep timer instrumentation and storage unchanged unless the user requests a separate timer change.
- Inspect the relevant implementation before describing a proposed change. Name the repeated loop, traversal, resolution, allocation, serialization, or process work it would remove.

## Candidate quality

For each candidate, record:

```text
ID and short title
measured stage and evidence
repeated work and expected change
complexity before -> after, with real input variables
plausible recoverable time and its evidence
correctness/performance risks
focused validation that would confirm or reject it
```

Use the actual input variables where relevant, such as files, AST nodes, rule passes, import/reference edges, or alias edges. Keep ideas independent; combine overlapping proposals or flag them as mutually exclusive. Do not count implementation variants of the same optimization as separate ideas.

Do not treat an enclosing timer as recoverable savings. Timer rows can nest or overlap, so never sum them without proving that the work is disjoint. Distinguish profiler self samples from inclusive samples. A stage or inclusive sample count only bounds possible savings; identify the specific removable work and a plausible portion of that bound. Do not call an idea “good” just because its parent stage is slow.

Use three dispositions:

- **GOOD (>=0.9s plausible):** a distinct mechanism targets measured, repeatable work with a plausible cold full-project saving of at least 0.9 seconds. This is a hypothesis, not a measured speedup.
- **UNSCORED / uncertain:** the mechanism is concrete, but current data cannot establish that 0.9 seconds is recoverable, or the estimate is close to the threshold and depends on unverified assumptions. State the exact measurement needed; do not count it toward a requested good-idea target.
- **BAD for target:** duplicate/already implemented, conflicts with known results, has a measured upper bound below 0.9 seconds, risks changing lint scope/diagnostics, or lacks a credible mechanism. Keep it in the record with a short reason; do not delete it.

Never inflate a requested count. Generate additional candidate batches and have the filter agent screen them until the requested number of GOOD ideas is reached, or explain the evidence-based limit and report the shortfall. Preserve rejected and unscored ideas with their dispositions so they are not proposed again without new evidence.

## Independent agent filter

Use one read-only agent as a skeptical filter for each substantial candidate batch. Provide the exact candidate text plus the relevant timing rows, profiler sample summaries, source/implementation findings, baseline scope, and any rejected/accepted experiments that constrain the ideas. Ask it to classify every ID as GOOD, UNSCORED, or BAD, with concise evidence and duplicate/conflict references. In particular, instruct it not to infer savings from parent timers or add overlapping timer rows.

The agent screens proposals; it does not execute commands, scripts, tests, formatters, profilers, or benchmarks and does not edit the shared journal or source. The coordinator owns evidence collection, candidate wording, journal edits, implementation, and any follow-up measurements. Reconcile the agent's rationale with the actual artifacts before adopting its labels; keep disagreements and uncertainty explicit.

## Record and handoff

Store persistent idea backlogs in the project's established performance journal, normally under `.ai-code-guard/`. Keep one stable ID per candidate and retain rejected rows with visible status. Summarize the number of GOOD, UNSCORED, and BAD ideas, the strongest measured hotspots, and the main remaining evidence gap. Clearly separate plausible ideas from optimizations already implemented or experimentally accepted.

Do not change code, disable rules, narrow analyzed files, alter diagnostics, or edit timer storage as part of idea discovery. If the user asks to try candidates, switch to the measurement and verification gates in `linter-performance` and test one isolated hypothesis at a time.
