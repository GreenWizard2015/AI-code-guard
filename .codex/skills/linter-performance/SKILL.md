---
name: linter-performance
description: Measure linter and test-runner speed; diagnose to zero and stage only after timing acceptance.
---

# Linter performance optimization

Use this skill when improving the linter, its Python bridge, or fixture-test
execution. Prioritize production lint speed; measure test-runner speed
separately when in scope. Performance acceptance is based on timing only.
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

## Acceptance score

Judge an optimization's timing threshold by comparing the candidate's best
cold-plus-warm sum with the accepted baseline's maximum cold-plus-warm sum:

```text
candidate minimum cold + candidate minimum warm
    < baseline maximum cold + baseline maximum warm
```

Select candidate minima and baseline maximums independently across their runs.
Stage timings, profiler samples, medians, paired totals, and diagnostics do not
affect the timing decision. Correctness checks remain a separate gate before
staging.
Do not compare the candidate against the baseline minimum, median, or historical
best when deciding this threshold. A candidate qualifies on timing when its
candidate minimum cold + candidate minimum warm is strictly below baseline maximum cold + baseline maximum warm.

## Measurement helper

Use the bundled helper for repeatable full-project measurements:

```bash
.codex/skills/linter-performance/measure-runs.sh \
  --target /absolute/path/to/target-project \
  --runs 3
```

The helper resolves the linter workspace from its own location. Each pair
clears only `<target>/.ai-code-guard/cache/`, runs cold, then runs warm from the
cache just produced. It uses `--policy all --batch-size 10000` and no review
agent. It snapshots each timing report and writes `runs.tsv` with wall time,
exit code, issue count, and analyzed-file count. Those diagnostic values are
informational and do not affect the timing score. The helper checks valid wall
time, stable file scope, and warm-cache behavior. It returns `0` when the
measurement is valid and the threshold passes or was not requested, `1` when a
valid candidate misses the requested timing threshold, and `2` for invalid
arguments or measurement integrity. A non-zero linter exit is recorded, not
treated as a benchmark failure. At least three pairs are required when a
threshold is supplied; fewer pairs can screen a candidate but cannot produce a
timing verdict.

The helper records timing reports and issue totals, not a complete
machine-readable diagnostic inventory; counts alone cannot serve as the
diagnostics-to-zero baseline. Use the shared current-state file at
`<linter-workspace>/.ai-code-guard/work-status.md` for this skill and
`diagnostics-to-zero`. Read or create it at task start and update it at accepted
measurement and integration checkpoints. Its schema and report-reuse rules are
in [`../diagnostics-to-zero/references/work-status.md`](../diagnostics-to-zero/references/work-status.md).

Use three matched pairs for baseline and candidates considered for acceptance.
One pair may screen out a poor candidate but cannot accept it. `--baseline-cold-max`
and `--baseline-warm-max` print the timing threshold result. Hotspot sampling
runs after all pairs so it cannot perturb a cold/warm pair.

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

- every cold and warm wall time, each mode's minimum, maximum, and median, the
  candidate minimum sum, the baseline maximum sum, the best paired total, and
  relevant stage times;
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
before capturing a baseline, before every screening/confirmation series, and
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

Check again at cold/warm pair boundaries where practical without delaying the
immediate warm run or perturbing its cache. If an appearance/disappearance is
observed during a series, mark that series inconclusive for timing acceptance,
refresh the control baseline under the stable new state, and remeasure the
candidate. Endpoint checks cannot prove that no short-lived transition happened;
record an observed transition even if the final state matches the initial state.
Do not stop, restart, pause, or otherwise modify `train.py` to stabilize results.

## Screen before confirmation

Start with a single full cold/warm pair using `--runs 1` **without baseline
threshold flags**; the helper requires at least three pairs with those flags.
Use this only to screen the hypothesis. Clearly poor timing with no evidence of
a recoverable bottleneck can end the experiment early; record `screened out`,
not a conclusive three-pair timing verdict. Borderline or promising candidates
proceed to a three-pair confirmation with the baseline maximum flags. Diagnostic
counts, hashes and medians must not be used to reject a timing-qualified candidate.

Do not finish two more pairs merely to formalize an obvious screening failure.
One pair cannot establish acceptance or prove the absence of a small speedup.
With the current helper, confirmation is a separate three-pair run; do not claim
it resumes a saved screen. Keep screen results separate from confirmation minima.
If the hypothesis is already strongly evidenced and will require confirmation
regardless of one noisy pair, go directly to three pairs instead of adding a
redundant screen. Preserve the exact acceptance formula without a new median,
historical-record, minimum-gain, or diagnostic-equality veto.

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
   A new baseline requires three matched cold/warm pairs. Use a single-pair screen to reject clearly
   unpromising experiments early; run three pairs for candidates that may be
   accepted. Include Python bridge/analysis changes in the same process.
   Retain every individual result and calculate the candidate timing value as
   minimum cold plus minimum warm. Record the accepted baseline's maximum cold
   plus maximum warm as the comparison threshold. Also record the fastest
   matched pair's combined cold and warm time.
3. Map the execution pipeline and its data flow: discovery, parsing, bridge
   startup, normalization, per-file rules, global rules, serialization, and
   reporting. Identify the actual hot stages from measurements.
4. Search prior attempts and write a sampler-grounded experiment card before
   implementing a hypothesis. Each
   hypothesis must name the repeated work, its expected bottleneck, the
   affected invalidation boundary, and the expected correctness risk.
5. Test one hypothesis per experiment, then measure the same command and the
   same scope. Do not combine unrelated changes before measuring them.
6. Accept or reject performance using the timing threshold only. Record issue
   totals and exit codes as context, not as inputs to the timing decision.
   Record rejected and inconclusive experiments too.
7. Only after a valid candidate passes the timing threshold, immediately load
   and execute [`diagnostics-to-zero`](../diagnostics-to-zero/SKILL.md) against
   the linter workspace. Continue through its fresh inventory until the
   requested diagnostic scope reaches zero or the user stops the task. Do not
   replace this with a summary, partial lint run, or optional note. Run relevant
   tests and type checks when permitted. Stage accepted performance paths
   after timing acceptance even if diagnostics remain; stage diagnostic-fix
   paths only after they reach zero. If timing fails or the measurement is
   invalid, do not start diagnostics-to-zero for that candidate.
8. After diagnostic repairs, follow the final-implementation timing gate below
   before promoting the next baseline. Continue while the requested goal and measured opportunities remain. Cover
   production lint first; optimize test-runner speed only when requested or
   when its overhead blocks lint work.

If an existing stage timer cannot distinguish the suspected work, add
temporary intermediate timers or use an appropriate profiler (CPU, wall-clock,
allocation, or process/IO profiling). First measure the instrumentation
overhead on the same command, keep it below the noise level where practical,
and label profiled results separately from production timings. Remove
temporary instrumentation after the experiment unless it is a deliberate,
low-overhead diagnostic feature covered by tests. Never infer a hotspot from
source inspection alone when a targeted measurement can settle it.

`measure-runs.sh` samples cold snapshots only after their cold/warm pairs
finish, so profiling does not delay the paired warm run. Sampling is
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
measurements=<every cold/warm run, candidate minima, baseline maxima, both sums, medians, best paired total, relevant stage/process times>
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
and profiler data to explain the affected work; accept the change only by the
candidate-minimum versus baseline-maximum timing threshold. When in scope,
report fixture-test timings separately; a test speedup never compensates for a
linter timing regression. Diagnostics are recorded separately and do not alter
the performance decision. After timing acceptance, invoke and complete
`diagnostics-to-zero` for the linter workspace before ending the task.

## Python analysis changes

When changing Python analysis, bridge lifecycle, fixture startup, or shared
caching, follow [`python-bridge-and-caching.md`](python-bridge-and-caching.md).
For other pipeline stages, do not load that reference.

## Measurement and acceptance

Each warm run must immediately follow its cold run and reuse that run's cache.
Compare only runs with the same target, command, scope, and configuration.
Accept or reject the performance experiment using the timing condition in the
Acceptance score section only. Diagnostics, counts, and exit codes are not part
of this decision; record them for the later quality gate. Relevant tests and
type checks remain separate correctness gates.

If timing misses the threshold or measurement integrity fails, revert only
that experiment's changes and preserve unrelated user and agent work; do not
start diagnostics-to-zero for that candidate. If timing passes, immediately
invoke [`diagnostics-to-zero`](../diagnostics-to-zero/SKILL.md) on the linter
workspace and continue until zero or an explicit user stop. Do not finish while
this follow-on skill has not been started. Track its status as `active`, `zero`,
or `blocked`; a blocker must be concrete and external. Run required checks when
permitted. Before handoff, set `timing=passed`, `diagnostics=active`, and the
accepted measurement ID in `work-status.md`. If a complete diagnostic report
from the exact accepted source snapshot, command, configuration and scope is
available, pass its path and snapshot ID to `diagnostics-to-zero` as the
baseline. Otherwise, let that skill capture one complete baseline and reuse it
through the diagnostic phase; do not run a separate duplicate baseline scan.
Apply the final-implementation timing gate below, then promote the
verified implementation's measurement ranges and threshold in `.ai-code-guard/linter-performance-log.md`,
then stage only accepted performance paths with explicit `git add -- <paths>`.
Stage diagnostic-fix paths only after the diagnostic report reaches zero. If
that work is incomplete, keep the accepted performance paths staged, leave
unfinished diagnostic paths unstaged, and report the separate gate status.
Capture the initial index/worktree state; stage only owned paths or hunks and
preserve pre-existing staged and unstaged changes. Never use `git add .`.

## Recheck timing after diagnostic repairs

Track `timing=passed|failed|unmeasured`, `diagnostics=active|zero|blocked`, and
`correctness=passed|failed|unverified` separately, tied to their actual snapshots.
An initial timing pass immediately triggers diagnostics-to-zero as required;
new diagnostics alone never revoke that timing pass.

If subsequent diagnostic repairs change executable code, analysis algorithms,
initialization, imports, cache behavior, configuration or measured target inputs,
the old timings no longer verify the final implementation. After reaching zero
and passing required correctness checks, measure that final tree with three
cold/warm pairs against the **pre-experiment accepted baseline**, under compatible
conditions. This is validation of the completed candidate, not a new unrelated
optimization. No timing rerun is needed for changes proven outside the executed
and measured inputs; record that reasoning.

Promote the final measured ranges only when the same timing formula passes.
If conditions changed, remeasure the saved control under those conditions rather
than comparing incompatible regimes. If the final timing fails, report the
initial pass and final failure separately; simplify or selectively revert only
owned experiment/repair changes, preserving unrelated work and meaningful tests.
Do not start a new optimization or claim the speedup is finalized while this
failure is unresolved. Previously staged candidate paths are provisional until
these final gates pass; preserve pre-existing index/worktree changes and never
use a broad reset to clean them up.

## Verification

Run the relevant unit/integration tests, type-check, and the complete linter.
Report baseline and optimized best cold times, best warm times, summed scores,
descriptive medians, process model, separate diagnostic-zero status, staged paths, and the
exact `target_project_path`. Do not claim completion from a lower summed time
alone.
If the user asks to stop, do not start further experiments; report current
measurements and outstanding verification accurately.
