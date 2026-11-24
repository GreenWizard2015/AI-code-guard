---
name: linter-performance
description: Measure and reduce the linter's cold-to-hot runtime ratio, then verify accepted changes.
---

# Linter performance optimization

Use this skill when improving the linter, its Python bridge, or fixture-test
execution. Measure production lint runs as exactly three matched cold/hot
pairs (six lint invocations). The sole optimization metric is
`min(cold_1, cold_2, cold_3) / min(hot_1, hot_2, hot_3)`; lower is better.
Choose the cold and hot minima independently, even when they come from
different pairs. Keep all six durations for reproducibility and diagnosis.
Diagnostic counts and hashes are informational during benchmarking; after a
candidate passes, immediately invoke the `diagnostics-to-zero` skill on the
linter workspace and continue until its requested scope reaches zero or the
user stops the work. This is required work, not an optional check.

Keep pursuing the requested performance goal across turns until the user says
to stop, pause, or finish. If asked to stop, stop starting experiments; report
the current accepted state and any verification still outstanding. Do not
claim unfinished work is verified.

## Required target argument

The skill requires one positional argument, `target_project_path`. It must be an
existing absolute directory. Never silently substitute the current directory.

```text
$linter-performance /absolute/path/to/target-project
```

The target is the codebase being analyzed. The linter workspace is the project
where the implementation is changed. Do not edit target source/configuration.
Benchmark runs may clear `<target>/.ai-code-guard/cache/` and refresh generated
state under `<target>/.ai-code-guard/`; preserve unrelated target files.

All persistent Markdown output created by this skill must be under the linter
workspace's `.ai-code-guard/` directory. This includes the performance log,
timing snapshots, and experiment reports. Do not create Markdown logs in the
workspace root, the target project root, or the skill directory. The skill's
own `SKILL.md` is instruction text and is the only intentional exception.

## Sole optimization metric: cold/hot ratio

Run exactly three matched cold/hot pairs: three cold invocations and three hot
invocations, six lint runs total. In each pair, hot must immediately follow
cold and reuse the cache that cold produced. Compute `best_cold` as the shortest
of the three cold durations and `best_hot` as the shortest of the three hot
durations, selecting each independently. The run's score is exactly
`best_cold / best_hot`; the two best durations may come from different pairs.
Compare that score with the accepted baseline score and accept only when it is
strictly lower. Do not
use paired ratios, absolute durations by themselves, files per second, issue
counts, profiler samples, or historical measurements as additional acceptance
gates. Record every duration and each paired ratio for diagnosis. Correctness
remains a separate gate.

## Measurement helper

Use the bundled helper for repeatable full-project measurements:

```bash
.codex/skills/linter-performance/measure-runs.sh \
  --target /absolute/path/to/target-project
```

The helper resolves the linter workspace from its own location and defaults to
three pairs. Pass `--runs N` for a user-requested descriptive benchmark with a
different sample count; standard optimization acceptance uses the three-pair
default. Each pair
clears only `<target>/.ai-code-guard/cache/`, runs cold, then runs hot from the
cache just produced. It uses `--policy all --batch-size 10000` and no review
agent. It snapshots each timing report and writes `runs.tsv` with wall time,
exit code, issue count, analyzed-file count, and informational `Files/sec`. It
writes `pairs.tsv` with cold time, hot time, and each paired ratio, then prints
the shortest cold time, shortest hot time, and `best_cold / best_hot` as the
primary score. Paired ratios and `Files/sec` are informational only.
Diagnostic values do not affect ratio acceptance.
The helper checks valid wall
time, stable file scope, and hot-cache behavior. It returns `0` when the
measurement is valid and the ratio threshold passes or was not requested, `1`
when a valid candidate misses the ratio threshold, and `2` for invalid
arguments or measurement integrity. A non-zero linter exit is recorded, not
treated as a measurement-integrity failure. The helper scores across the
requested pair count. Standard optimization comparisons use exactly three
pairs; the threshold compares `best_cold / best_hot` with the baseline score.

The helper records timing reports and issue totals, not a complete
machine-readable diagnostic inventory; counts alone cannot serve as the
diagnostics-to-zero baseline. Use the shared current-state file at
`<linter-workspace>/.ai-code-guard/work-status.md` for this skill and
`diagnostics-to-zero`. Read or create it at task start and update it at accepted
measurement and integration checkpoints. Its schema and report-reuse rules are
in [`../diagnostics-to-zero/references/work-status.md`](../diagnostics-to-zero/references/work-status.md).

## Production entrypoint identity

Use the linter's normal packaged executable for acceptance measurements when
the repository provides one. In this workspace, rebuild after source changes
with `pnpm build:cli`, then pass
`AI_CODE_GUARD_BIN="$linter_workspace/bin/ai-code-guard.mjs"` to the helper.
Record the executable path and build revision with the baseline. A source-only
launcher such as `tsx src/core/cli.ts` has different startup and hot-cache
costs; treat it as a separate measurement regime. Never compare its ratio with
the packaged executable's ratio. Keep the same entrypoint and build method for
all three-pair controls and candidates; rebuild after every source change.

Use three matched pairs for every baseline and candidate comparison; do not
screen candidates with a one-pair benchmark. Pass
`--baseline-cold-hot-ratio` to print whether the primary-score threshold passes.
Hotspot sampling runs after all pairs so it cannot perturb a cold/hot pair.

Do not spawn or assign agents by default. The coordinator performs investigation,
implementation, and validation directly. Use [`agent-protocol.md`](agent-protocol.md)
only when the user explicitly requests agent participation; keep benchmark runs
and baseline promotion with one coordinator. This restriction concerns performance
agents; the required diagnostics-to-zero phase follows that skill's own delegation
rules. Implementation/investigation agents must not launch any processes,
directly or indirectly, including shell, read-only Git, tests, scripts, formatters,
profilers or benchmarks. They use non-process inspection/editing tools and request
necessary commands from the coordinator. All process execution belongs to the
coordinator.

## Baseline first

Before changing code, record a representative paired baseline for the full
production lint command. Measure fixture/test-runner time separately only when
test performance is in scope or its overhead is blocking lint work:

- analyzed-file count, all cold/hot wall times and paired ratios, the baseline
  and candidate `best_cold / best_hot` scores, and relevant stage times;
- process count and Python bridge startup/exit behavior;
- complete diagnostics, including rule, file, line, message, hint, and exit code;
- the files and fixture set included in the measurement.

Use the repository's normal commands and configuration. Account for the
project's actual file scope and `.gitignore` behavior; do not replace scope
with an unvalidated glob or an implicit working directory.


## Reuse the accepted baseline

Record a baseline identity: implementation revision plus relevant worktree
fingerprint, target content/scope, exact command/configuration, toolchain, and
known load regime. Reuse its three-pair measurements across rejected experiments
when that identity remains applicable and the accepted implementation is restored.
Do not rerun three unchanged control pairs before every hypothesis. Refresh the
baseline after an accepted implementation change, target/configuration changes,
a user-reported load change, or concrete evidence that conditions changed. A
candidate's final valid three-pair measurement may serve as the next baseline;
do not immediately measure the same tree again. Keep historical records but do
not compare incompatible load regimes. Never stop unrelated user processes to
make conditions match.

## Track train.py load transitions

The coordinator checks whether a training process running `train.py` is present
before capturing a baseline, before every three-pair measurement series, and
after that series. Inspect live process arguments and match the actual script
path/basename `train.py`; do not count the inspection command itself or unrelated
arguments merely mentioning that text. Record `train_present=true|false`, matching
PIDs, and check timestamps with each measurement. Only the coordinator runs this
inspection; agents remain prohibited from launching processes.

Baseline compatibility requires the same `train_present` state. Whenever
`train.py` appears or disappears compared with the accepted baseline, capture a
new three-pair baseline on the accepted control implementation under the new
state **before comparing a candidate**. If a candidate is already applied, preserve
its owned diff and measure the saved control separately or selectively restore
it without disturbing unrelated changes; do not relabel candidate timings as a
control baseline. Mere continued presence does not require a baseline refresh
before every attempt; other measured load changes still follow baseline rules.

Check again at cold/hot pair boundaries where practical without delaying the
immediate hot run or perturbing its cache. If an appearance/disappearance is
observed during a series, mark that series inconclusive for ratio acceptance,
refresh the control baseline under the stable new state, and remeasure the
candidate. Endpoint checks cannot prove that no short-lived transition happened;
record an observed transition even if the final state matches the initial state.
Do not stop, restart, pause, or otherwise modify `train.py` to stabilize results.

## Prepare the next experiment during measurements

Before implementation, search the existing experiment log by stage, code path
and mechanism. Revisit a rejected hypothesis only with new evidence or changed
conditions; record what changed. Maintain a compact experiment card in the same
log rather than a second document:

```text
selected_stage=<sampler result and source snapshot>
repeated_work=<specific loop/traversal/allocation and measured cost>
complexity=<before -> proposed after, real input variables>
expected_gain=<plausible full-run benefit relative to measured stage cost>
prior_attempts=<matching attempts, outcomes, and new evidence if retrying>
risks=<cache/order/lifetime and adjacent lint-rule constraints>
change_and_check=<smallest implementation slice and focused correctness check>
```

Start with a sampler-selected stage and a deep algorithmic analysis of that
stage. Do not optimize a neighboring stage simply because it looks easier.
Use a measured call/data dependency to justify another location; if all sampled
candidates lack actionable work, record why and use a fresh appropriate snapshot.
Sampled time is a prioritization aid, not evidence that a specific loop is slow.
Check neighboring lint constraints before adding helpers, classes or caches.

While a benchmark process runs, the coordinator reads existing source/profiles,
checks prior attempts and prepares the next experiment card. Do not edit the
measured implementation, target or configuration, change caches, instrument it,
or start competing heavy processes. Defer implementation and new profiling until
the current measurement finishes. Waiting is appropriate only when no useful
independent analysis remains; do not replace it with repetitive status polling.

## Required work algorithm and experiment log

Follow this algorithm in order; do not jump directly to a code change:

1. Validate the target path and record the exact command, configuration, file
   scope, ignored paths, fixture set, and environment relevant to timing.
2. Establish or reuse the compatible baseline before changing implementation code.
   Every new baseline and candidate comparison uses exactly three matched
   cold/hot pairs. Include Python bridge/analysis changes in the same process.
   Retain every individual result and paired ratio. Score the run as the
   shortest cold duration divided by the shortest hot duration, selected
   independently across the three pairs. Files/sec may be displayed only.
3. Map the execution pipeline and its data flow: discovery, parsing, bridge
   startup, normalization, per-file rules, global rules, serialization, and
   reporting. Identify the actual hot stages from measurements.
4. Search prior attempts and write a sampler-grounded experiment card before
   implementing a hypothesis. Each
   hypothesis must name the repeated work, its expected bottleneck, the
   affected invalidation boundary, and the expected correctness risk.
5. Test one hypothesis per experiment, then measure the same command and the
   same scope. Do not combine unrelated changes before measuring them.
6. Accept or reject performance using `best_cold / best_hot` only.
   Record issue totals, exit codes, and Files/sec as context, not as inputs to
   the ratio decision.
   Record rejected and inconclusive experiments too.
7. Only after a valid candidate passes the ratio threshold, immediately
   load and execute [`diagnostics-to-zero`](../diagnostics-to-zero/SKILL.md) against
   the linter workspace. Continue through its fresh inventory until the
   requested diagnostic scope reaches zero or the user stops the task. Do not
   replace this with a summary, partial lint run, or optional note. Run relevant
   tests and type checks when permitted. Stage accepted performance paths
   after ratio acceptance even if diagnostics remain; stage diagnostic-fix
   paths only after they reach zero. If the ratio fails or the measurement is
   invalid, do not start diagnostics-to-zero for that candidate.
8. After diagnostic repairs, follow the final-implementation ratio gate
   below before promoting the next baseline. Continue while the requested goal
   and measured opportunities remain. Cover
   production lint first; optimize test-runner ratios only when requested or
   when its overhead blocks lint work.

## Mandatory profiling before optimization

Before every implementation experiment, capture a fresh profile of the
currently accepted tree. Choose a profiler that can attribute the measured
cost: CPU sampling for computation, wall-clock or process/IO sampling for
waiting, and allocation profiling when allocation or garbage collection is a
candidate. Stage-duration tables and `sample-hotspots.mjs` identify where time
is reported, but do not replace a profiler that identifies the responsible
functions or processes. Profile the full requested command and file scope.

Measure profiler overhead against an unprofiled run under the same command,
scope, and comparable machine load. Keep profiles outside cold/hot ratio pairs and
label profiled timings separately; do not use them to accept a candidate.
Record the profile path, tool and command, scope, unprofiled/profiled durations,
estimated overhead, and the specific function/process evidence supporting the
next hypothesis. If profiler overhead is too high or it cannot resolve the
hotspot, use narrower sampling or temporary intermediate timers, measure their
overhead, and preserve the same evidence. Do not edit based only on stage totals
or source inspection when a targeted profile can identify the work. After a
candidate passes, profile it again when needed to verify that the targeted cost
fell and no new hotspot dominates; ratio acceptance still uses only the
unprofiled cold/hot pairs.

If an existing stage timer cannot distinguish the suspected work, add
temporary intermediate timers or use an appropriate profiler (CPU, wall-clock,
allocation, or process/IO profiling). First measure the instrumentation
overhead on the same command, keep it below the noise level where practical,
and label profiled results separately from production timings. Remove
temporary instrumentation after the experiment unless it is a deliberate,
low-overhead diagnostic feature covered by tests. Never infer a hotspot from
source inspection alone when a targeted measurement can settle it.

`measure-runs.sh` samples cold snapshots only after their cold/hot pairs
finish, so profiling does not delay the paired hot run. Sampling is
deterministic for a given snapshot. It prints up to five candidate stages,
their durations, and sample counts. To sample a report manually or adjust the
default temperature, use:

```bash
node .codex/skills/linter-performance/sample-hotspots.mjs \
	.ai-code-guard/performance-runs/<measurement-id>/cold_<run-count>.performance.md
```

The sampler ignores aggregate stages and ranks positive-duration leaf stages;
it is a deterministic guide for the next hypothesis, not profiler evidence or
an acceptance measurement. Read [`hotspot-analysis.md`](hotspot-analysis.md)
when interpreting its weights, temperature, or hierarchy behavior.

For task-start journal handling and the required 50-idea checklist, read
[`references/performance-journal.md`](references/performance-journal.md) only
when starting a new performance task or updating that journal. Do not load it
for ordinary measurement continuations.

Every attempt, including failed, rejected, unchanged, screened-out or
zero-improvement attempts, must be represented. The following fields describe
the information to retain in the compact row/card or the saved measurement artifacts, not
a requirement to repeat a multiline report for each attempt:

```text
attempt=<monotonic number>
scope=<target, command, and fixture set>
hypothesis=<specific repeated work expected to be reduced>
change=<one experiment or no-code measurement>
complexity_before=<variables and estimated time/space complexity>
complexity_after=<variables and estimated time/space complexity>
measurements=<all six cold/hot durations and paired ratios, candidate and baseline best_cold / best_hot scores, relevant stage/process times; Files/sec is informational>
diagnostic_metadata=<issue totals and exit codes; informational, not an acceptance criterion>
decision=<kept|rejected|inconclusive>
reason=<evidence and next hypothesis>
```

The compact log must identify any delegated hypothesis, briefly state the evidence that
confirmed or disproved it, and name the next step. A claim such as “the cache should be faster”
is not sufficient without measurements. Keep the log in `.ai-code-guard`; do
not create a second copy in the repository root.

## Mandatory optimization attempts

Form a measured hypothesis before changing code. Prefer an algorithmic and an
execution-overhead hypothesis when both are supported by the profile; do not
implement an unrelated category just to satisfy a quota. The first priority is the production linter path:

- one algorithmic hypothesis: eliminate duplicate AST traversal, alias/type
  resolution, rule work, or global indexing; consider a shared index or an
  explicitly invalidated cache;
- one execution-overhead hypothesis: reuse bridge/test processes, batch
  requests, reduce serialization or filesystem work, or remove repeated
  startup and teardown.

Use intermediate timings or a profiler for either hypothesis when the current
stage timings do not identify the responsible loop, traversal, process, or
allocation. The experiment log must state which profiler/timers were used,
their overhead, and which measured result selected the next experiment.

If one category is not applicable, record the measured reason and evidence for
that decision; do not silently skip it. Do not optimize by
reducing the checked file scope, disabling rules, weakening diagnostics, or
using `.gitignore` to hide work.

Before and after each candidate change, state the computational model using
the real input variables. At minimum consider:

- `F`: files, `N`: total AST nodes, `P`: Python sources, `R`: rule passes,
  `E`: import/reference edges, and `A`: alias/type/container edges;
- whether work is `O(F)`, `O(N)`, `O(RN)`, `O(E + A)`, or a nested/product
  combination, and which loop or recursive traversal causes it;
- memory growth, cache invalidation, scope/shadowing boundaries, and whether a
  proposed index changes ordering or observable state.

Prefer lowering a repeated factor (for example `O(RN)` to `O(N + R)` where
the semantics allow it) over a local constant-factor change. Use stage timings
and profiler data to explain the affected work; accept the change only when
`best_cold / best_hot` is lower than the baseline score. When fixture-test work
is in scope, report its score separately.
Diagnostics are recorded separately and do not alter the ratio decision. After
ratio acceptance, invoke and complete
`diagnostics-to-zero` for the linter workspace before ending the task.

## Python analysis changes

When changing Python analysis, bridge lifecycle, fixture startup, or shared
caching, follow [`python-bridge-and-caching.md`](python-bridge-and-caching.md).
For other pipeline stages, do not load that reference.

## Measurement and acceptance

Each hot run must immediately follow its cold run and reuse that run's cache.
Compare only runs with the same target, command, scope, and configuration.
Accept or reject the performance experiment using `best_cold / best_hot` as
defined in the primary metric section.
Files/sec may be displayed but must not affect this decision. Diagnostics,
counts, and exit codes are not part of this decision; record them for the later
quality gate.
Relevant tests and type checks remain separate correctness gates.

If the ratio misses its threshold or measurement integrity fails, revert only
that experiment's changes and preserve unrelated user and agent work; do not
start diagnostics-to-zero for that candidate. If the ratio passes, immediately
invoke [`diagnostics-to-zero`](../diagnostics-to-zero/SKILL.md) on the linter
workspace and continue until zero or an explicit user stop. Do not finish while
this follow-on skill has not been started. Track its status as `active`, `zero`,
or `blocked`; a blocker must be concrete and external. Run required checks when
permitted. Before handoff, set `timing=passed` (the shared status field for the
ratio gate), `diagnostics=active`, and the accepted measurement ID in
`work-status.md`. If a complete diagnostic report
from the exact accepted source snapshot, command, configuration and scope is
available, pass its path and snapshot ID to `diagnostics-to-zero` as the
baseline. Otherwise, let that skill capture one complete baseline and reuse it
through the diagnostic phase; do not run a separate duplicate baseline scan.
Apply the final-implementation ratio gate below, then promote the
verified implementation's measurement ranges and ratio threshold in `.ai-code-guard/linter-performance-log.md`,
then stage only accepted performance paths with explicit `git add -- <paths>`.
Stage diagnostic-fix paths only after the diagnostic report reaches zero. If
that work is incomplete, keep the accepted performance paths staged, leave
unfinished diagnostic paths unstaged, and report the separate gate status.
Capture the initial index/worktree state; stage only owned paths or hunks and
preserve pre-existing staged and unstaged changes. Never use `git add .`.

## Recheck the ratio after diagnostic repairs

Track `timing=passed|failed|unmeasured` (the shared status field for ratio),
`diagnostics=active|zero|blocked`, and
`correctness=passed|failed|unverified` separately, tied to their actual snapshots.
An initial ratio pass immediately triggers diagnostics-to-zero as
required; new diagnostics alone never revoke that pass.

If subsequent diagnostic repairs change executable code, analysis algorithms,
initialization, imports, cache behavior, configuration or measured target inputs,
the old timings no longer verify the final implementation. After reaching zero
and passing required correctness checks, measure that final tree with three
cold/hot pairs against the **pre-experiment accepted baseline**, under compatible
conditions. This is validation of the completed candidate, not a new unrelated
optimization. No timing rerun is needed for changes proven outside the executed
and measured inputs; record that reasoning.

Promote the final measured ranges only when the same ratio formula passes.
If conditions changed, remeasure the saved control under those conditions rather
than comparing incompatible regimes. If the final ratio fails, report the
initial pass and final failure separately; simplify or selectively revert only
owned experiment/repair changes, preserving unrelated work and meaningful tests.
Do not start a new optimization or claim the ratio gain is finalized while this
failure is unresolved. Previously staged candidate paths are provisional until
these final gates pass; preserve pre-existing index/worktree changes and never
use a broad reset to clean them up.

## Verification

Run the relevant unit/integration tests, type-check, and the complete linter.
Report baseline and optimized `best_cold / best_hot` as the primary
result. The helper also displays `Files/sec` as informational context only;
never use it to rank or accept a candidate. Include the paired durations,
process model, separate diagnostic-zero status, staged paths, and exact
`target_project_path`. Do not claim completion from ratio reduction alone.
If the user asks to stop, do not start further experiments; report current
measurements and outstanding verification accurately.
