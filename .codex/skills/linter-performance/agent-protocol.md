# Optional agent protocol for performance work

This protocol applies only when the user explicitly requests agents or
delegation. Do not spawn, assign, or otherwise invoke agents by default. When
working without an explicit delegation request, the coordinator handles
investigation, implementation, measurement, and validation directly.

If the user requests delegation, parallelize read-only investigation of
independent hypotheses. Keep implementation ownership, cache-clearing
benchmarks, baseline promotion, and integration with one coordinator unless the user explicitly expands that
scope. The diagnostic-zero phase follows diagnostics-to-zero ownership rules,
including coordinator-owned small fixes and delegated larger batches; its agents
also must not launch processes.

## Assignment

Give each agent the exact `target_project_path`, linter workspace, report
snapshot/commit, measured stage evidence, owned and prohibited paths, and
whether code edits are allowed. Agents must not launch any processes, directly
or indirectly: no shell, read-only Git commands, scripts, tests, formatting,
profiling, benchmarks, subprocesses or background jobs. Use non-process tools;
request necessary commands and their purpose from the coordinator. Restrict an assignment to one
pipeline slice when possible: discovery, parsing/AST preparation, Python
bridge, rule traversal/indexing, serialization, or fixture startup.

Ask for a concise report:

```text
hypothesis=<repeated work and measured evidence>
stage=<where the time is spent>
complexity=<before -> expected after, with real input variables>
change_slice=<files or functions; no edits if investigation-only>
expected_gain=<which measured phase should improve>
risk=<diagnostics, ordering, scope, invalidation, process-state risks>
validation=<focused check requested from coordinator; agents never execute processes>
next_step=<implement, reject, or investigate>
```

Do not request periodic heartbeat messages. If the user asks for agents to
implement work, assign non-overlapping paths and require a start report, a
meaningful progress update for long tasks, and a final report of completed and
remaining work. If an agent's result is partial, reconcile the remaining scope
and assign the remainder only as explicitly requested by the user.

## Measurement and integration

The coordinator alone captures baseline and candidate timings. Before a run,
wait for a stable diff and pause edits to benchmarked files. Run matched
cold/warm pairs without profiling between a pair. Use `runs.tsv` and the
snapshot directory as evidence. Decide performance solely from the timing
threshold; diagnostic counts and exit codes are metadata.

After a valid timing pass, the coordinator immediately invokes and completes
`diagnostics-to-zero` for the linter workspace. Stage accepted performance
paths after the timing pass and diagnostic-fix paths only after diagnostics
reach zero. If diagnostic repairs change measured execution, the coordinator remeasures the
final zero-diagnostic tree with three pairs against the pre-experiment baseline
before promoting its ranges. Keep initial timing passage, diagnostic-zero status,
correctness and final timing verification separate. Capture the starting index/worktree state; stage only owned paths
or hunks with explicit `git add -- <paths>`. Never run `git add .` or stage
another agent's work.

At baseline and after each integrated batch, give the user a short update with
the snapshot, timing score and verdict, diagnostic-zero status, and next step.

The coordinator also checks actual `train.py` process presence before and after
measurement series and records state, PIDs and timestamps. Appearance or
disappearance relative to the baseline requires a new three-pair control baseline;
a transition during a series makes that series inconclusive. Agents never run
this inspection or modify the training process. Follow `SKILL.md` for preserving
a candidate while remeasuring the accepted control.

At a new performance task, the coordinator clears the performance journal after
carrying forward only a compact compatible-baseline/rejected-mechanism summary.
Continuations and baseline refreshes preserve it. Keep one concise attempt row
with verdict and attempt numbers; individual timings remain in snapshot artifacts.
Do not duplicate verbose reports or create a second journal.

The coordinator maintains exactly 50 concrete optimization ideas (`I01`–`I50`)
as a compact checklist in the same performance journal. Keep one line per idea,
explicit statuses, attempt numbers and concise outcomes; do not add links. Evaluated means checked, not
necessarily accepted; keep rejected ideas visible. Agents report the relevant
idea ID to the coordinator rather than editing the shared journal. The checklist
is an inventory, not a requirement to implement every idea.
