---
name: linter-performance
description: Measure and optimize linter and test-runner performance while preserving complete diagnostic equivalence.
---

# Linter performance optimization

Use this skill when improving the linter, its Python bridge, or fixture-test
execution. Prioritize linter execution speed; improve test-runner speed after
the production lint path or when test overhead directly affects lint
development. Both paths must retain exactly the same diagnostic multiset and
exit behavior; diagnostic ordering is not significant.

## Required target argument

The skill requires one positional argument, `target_project_path`. It must be an
existing absolute directory. Never silently substitute the current directory.

```text
$linter-performance /absolute/path/to/target-project
```

The target is the codebase being analyzed. The linter workspace is the project
where the implementation is changed. Do not modify the target project unless
the user explicitly asks for it.

All persistent Markdown output created by this skill must be under the linter
workspace's `.ai-code-guard/` directory. This includes the performance log,
timing snapshots, and experiment reports. Do not create Markdown logs in the
workspace root, the target project root, or the skill directory. The skill's
own `SKILL.md` is instruction text and is the only intentional exception.

## Measurement helper

Use the bundled helper when a repeatable run measurement is needed:

```bash
.codex/skills/linter-performance/measure-runs.sh \
  --target /absolute/path/to/target-project \
  --clear-cache
```

The helper resolves its own linter workspace from the script path, so it does
not depend on the caller's current directory. `--target` is required and must
be an existing absolute directory. Without `--clear-cache`, it removes the old
known cache and measures one run. `--clear-cache` selects cold-run mode: it
removes the complete `<target>/.ai-code-guard/cache/` directory before the
measured run. It does not remove reports,
issues, rules, review files, or source files. `--runs N` changes the default
three comparable runs. The helper always passes `--policy all --batch-size
10000` and does not select a review agent, so architecture review is skipped.
The linter writes detailed stage timings to
`.ai-code-guard/performance.md`; the helper snapshots that file for every run
under the linter workspace's `.ai-code-guard/performance-runs/` directory and
prints only total wall time and consistency data. It verifies that all measured
runs have the same exit code, issue/file totals, and order-insensitive hashes
of every diagnostic's file, line, message, hint, rule ID, and priority from the
complete cached lint result. It fails consistency checking if that full result
is unavailable; prioritized `issues.md` and `report.md` are not complete
diagnostic evidence.
When an experiment changes the Python bridge or Python analysis code, invoke the
helper with `--runs 8` instead of the default three runs. Keep three runs for
experiments that are strictly TypeScript or measurement-only.
The helper prints average and median wall times.
The helper returns the first non-zero linter exit code after all requested runs
finish, or `2` when measured runs are inconsistent, while still printing every
individual `RUN_*_EXIT` value.

## Required webmcp-userscripts run

When the target is
`/home/anton/Documents/Development/personal-assistant/webmcp-userscripts`, use
the exact full-project command below:

```text
ai-code-guard --root /home/anton/Documents/Development/personal-assistant/webmcp-userscripts --policy all --batch-size 10000
```

The run must omit a review-agent selection, select all policy problems, and use
a batch size of 10000. Evaluate optimization by total wall time and total
problems/files for the complete run. Individual batch or stage timings are
supporting evidence only and must not replace the total comparison.

## Baseline first

Before changing code, record a representative baseline for the full check and
for fixture tests:

- wall time and relevant stage times;
- process count and Python bridge startup/exit behavior;
- complete diagnostics, including rule, file, line, message, hint, and exit code;
- the files and fixture set included in the measurement.

Use the repository's normal commands and configuration. Account for the
project's actual file scope and `.gitignore` behavior; do not replace scope
with an unvalidated glob or an implicit working directory.

## Required work algorithm and experiment log

Follow this algorithm in order; do not jump directly to a code change:

1. Validate the target path and record the exact command, configuration, file
   scope, ignored paths, fixture set, and environment relevant to timing.
2. Run and record the baseline before changing implementation code. Capture at
   least three comparable runs when startup noise is material, or eight when the
   experiment changes Python bridge or Python analysis code; use the median and
   retain every individual result.
3. Map the execution pipeline and its data flow: discovery, parsing, bridge
   startup, normalization, per-file rules, global rules, serialization, and
   reporting. Identify the actual hot stages from measurements.
4. Write concrete optimization hypotheses before implementing them. Each
   hypothesis must name the repeated work, its expected bottleneck, the
   affected invalidation boundary, and the expected correctness risk.
5. Test one hypothesis per experiment, then measure the same command and the
   same scope. Do not combine unrelated changes before measuring them.
6. Keep or reject the experiment using both the complete diagnostic comparison
   and the measured result. Record rejected and inconclusive experiments too.
7. Repeat until the linter execution path has had a deliberate optimization
   pass. Then optimize test-runner/fixture execution when it is in scope, or
   record evidence that it is not a bottleneck, before final verification.

If an existing stage timer cannot distinguish the suspected work, add
temporary intermediate timers or use an appropriate profiler (CPU, wall-clock,
allocation, or process/IO profiling). First measure the instrumentation
overhead on the same command, keep it below the noise level where practical,
and label profiled results separately from production timings. Remove
temporary instrumentation after the experiment unless it is a deliberate,
low-overhead diagnostic feature covered by tests. Never infer a hotspot from
source inspection alone when a targeted measurement can settle it.

Every attempt, including a failed, rejected, unchanged, or zero-improvement
attempt, must be appended to
`.ai-code-guard/linter-performance-log.md` in the linter workspace. Never
replace earlier entries. Use this minimum record:

```text
attempt=<monotonic number>
scope=<target, command, and fixture set>
hypothesis=<specific repeated work expected to be reduced>
change=<one experiment or no-code measurement>
complexity_before=<variables and estimated time/space complexity>
complexity_after=<variables and estimated time/space complexity>
measurements=<every run, median, relevant stage/process times>
diagnostic_fingerprint=<complete diagnostic hash and exit code>
decision=<kept|rejected|inconclusive>
reason=<evidence and next hypothesis>
```

The log must include the agent's guesses, the evidence that confirmed or
disproved them, and the next step. A claim such as “the cache should be faster”
is not sufficient without measurements. Keep the log in `.ai-code-guard`; do
not create a second copy in the repository root.

## Mandatory optimization attempts

For every optimization cycle, make and measure at least two distinct
hypotheses before concluding that the current implementation is sufficiently
fast. The first priority is the production linter path:

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

If one category is not applicable, record the measured reason and the evidence
for that decision in the log; do not silently skip it. Do not optimize by
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
the semantics allow it) over a local constant-factor change. Any claimed
complexity improvement must be backed by stage timings on the normal target
and, when in scope, fixture tests. Report linter and test-runner timings
separately; a test speedup never compensates for a linter regression. Keep a
change only if the full diagnostic multiset fingerprint, parse-error behavior, bridge contract,
and exit status remain identical.

## Python bridge contract

For one linter run:

1. Start one persistent Python bridge process.
2. Send all pending Python sources in one batch of `name -> source` records.
3. Include a unique `batchId` and verify that the response has the same ID and
   every requested AST.
4. Prepare each Python AST and normalized source record once, then reuse them
   for class analysis, coding rules, references, and other consumers.
5. Send an explicit exit only after the final request and verify clean exit.

Do not start one Python process per Python file, rule, or fixture when the
bridge can safely serve the whole run.

## Reuse and caching

Reuse stable data only when its invalidation boundary is explicit:

- keep the bridge alive for all requests in a run;
- reuse a parsed AST and source record across all consumers;
- cache stable project-file information used by import and unused-file checks;
- in fixture tests, reuse one bridge and batch fixture sources instead of
  creating a process for each file or test case;
- clear or replace state between independent runs and verify that no aliases,
  diagnostics, or AST nodes leak across runs.

Do not cache mutable rule results across different source contents, roots, or
policy configurations.

## Measurement and acceptance

Measure startup, bridge, parsing/normalization, per-file analysis, global
analysis, and total wall time. Repeat enough times to distinguish a real
improvement from startup noise.

Accept an optimization only when:

- complete diagnostics are identical to the baseline;
- parse errors, missing files, empty input, and Python-free projects still work;
- batch IDs, requested-source coverage, and explicit bridge exit are verified;
- tests do not depend on process state from a previous fixture;
- the measured improvement is real for both a normal project run and fixture
  tests, when both paths are in scope.

If performance improves but diagnostics differ, reject the change and fix the
correctness regression before measuring again.

Do not treat one faster run as evidence of an improvement. Compare repeated
runs with the same scope, report the median (and the individual runs), and
explain startup variance. A performance experiment is incomplete until its
entry has been written to `.ai-code-guard/linter-performance-log.md`.

Use the median timing criterion when accepting a faster experiment: after
diagnostics and tests pass, accept the new experiment only if its median full
run is lower than the median of the best accepted experiment. Report minimum
and maximum values to expose noise, but do not make the decision from the
average, minimum, or maximum alone.

When an experiment is accepted, immediately promote its measurements to the
new baseline in `.ai-code-guard/linter-performance-log.md` and stage only the candidate's
implementation, regression tests, and performance record with `git add`. Do
not stage unrelated user changes already present in the worktree. The accepted
log entry must name the new baseline median and the staged paths; a rejected or
control experiment must never stage code.

## Verification

Run the relevant unit/integration tests, type-check, and the complete linter.
Report the baseline and optimized timings, process model, diagnostic
comparison, and the exact `target_project_path`. Do not claim completion from
an elapsed-time improvement alone.
