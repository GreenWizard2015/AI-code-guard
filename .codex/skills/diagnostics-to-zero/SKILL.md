---
name: diagnostics-to-zero
description: Reduce a project's lint or static-analysis findings to zero by triaging root causes, fixing real defects and false positives, adding focused regression tests, and verifying the integrated result without hiding diagnostics.
metadata:
  short-description: Resolve lint findings to zero
---

# Diagnostics to zero

Reach zero findings in the requested analyzer scope while preserving behavior, rule semantics, thresholds, and coverage. Optimize for elapsed time to a verified clean tree, not the count removed by one edit.

## Roles and delegation

Delegate substantial implementation batches to available agents with a real assignment recording agent ID, snapshot/findings, bounded write paths, and acceptance criteria. Assigned agents edit directly and do not recursively delegate. Reuse agents and parallelize independent batches with disjoint ownership.

**The coordinator may directly close small files and minor findings** while agents handle larger batches. Choose bounded, understood changes with no shared architectural redesign: local naming/order corrections, simple types/imports, obsolete declarations, or other small coherent repairs. File length alone does not make a change safe or independent. Record a coordinator-owned batch with exact findings and write paths before editing, check callers and adjacent rules, and validate it like any agent batch. Never edit a live agent's scope or shared dependencies without an explicit handoff. Small follow-up repairs and selective reversions are also permitted within the coordinator's owned scope; substantial work remains delegated. If delegation is unavailable, continue eligible small independent repairs and read-only triage, and report blocked larger batches without claiming zero.

Implementation agents may use read-only shell commands (such as `cat`, `sed`, `rg`, and `ls`) to inspect assigned source, tests, and rule documentation, and may use patch/file-editing tools to change only their assigned paths. They must not run project commands or start application/background processes: no tests, syntax/type checks, lint, formatters, Git commands, or scripts. If a useful check is needed, they send the coordinator the exact command, purpose, inputs, and expected outputs; the coordinator runs it and returns the result. Do not bypass the check restriction through another tool or agent. The coordinator owns checks, inventory, integration, and final validation. Keep agents open unless the user asks to close them.

Read [references/agent-protocol.md](references/agent-protocol.md) when assigning work. These ownership requirements apply to fixing diagnostics, not to editing this skill or analyzing past sessions.

## 1. Obtain one trustworthy baseline

- Read repository guidance, scripts, CI configuration, and the current branch/worktree; preserve unrelated user changes and current command restrictions.
- Read or create the shared current-state file at `<linter-workspace>/.ai-code-guard/work-status.md`; use [references/work-status.md](references/work-status.md) for its compact schema. Update that file in place at each integration checkpoint; keep detailed attempt history in the existing diagnostic/performance logs.
- Identify the exact command, configuration, scope, and zero target. Capture a complete machine-readable report, command/exit status, revision and worktree fingerprint. Keep the original baseline and successive snapshots; never compare an old report as if it described the current tree.
- Reuse a complete report from a preceding benchmark or skill only when target, source/worktree fingerprint, command, configuration, and analyzed scope match this baseline. A timing summary or issue count is not a diagnostic inventory. If a benchmark produced no complete report, make one full baseline run and pass that report forward instead of repeating it later in this workflow.
- Distinguish **all analyzer findings**, **findings visible after suppression**, and **the selected repair batch**. A priority-filtered `issues.md`, a larger batch limit, or a flag named `all` does not prove completeness. Reconcile the analyzer total with the full result before choosing work. Discover and record the extraction command once; reuse it instead of repeatedly investigating report generation.
- Where available, read the existing per-file fix plan: current maximum and tied rules, deferred lower-priority findings, directory/placement blockers, and batch limits. Do not implement new reporting infrastructure as part of ordinary cleanup.
- Summarize immediately: `Baseline: <total> findings / <files> files; largest groups: <rules/counts>; snapshot: <id>; next: <batch>.` If only a partial inventory is available, label it partial and resolve the access gap before claiming complete accounting.
- For supported JSON reports use `python -m scripts.diagnostics_to_zero.diagnostic_summary_command <current.json> --compare <previous.json>`. Also compare to the original baseline at integration milestones. Its rule/path/message fingerprints are comparison aids: reconcile moved files, changed wording, duplicates, and symbols against source before interpreting churn as resolved/new work.

## 2. Plan a complete repair, not a single-rule edit

Group findings by root cause and coherent owner. Classify them as confirmed defects, expected code changes, analyzer false positives, or unclear; inspect representative cases before changing a shared rule. Track rule, path, symbol/context, message, location, fingerprint, owner, and status.

Treat repair batches as blocks in a dependency graph. Connect batches that share files, APIs/callers, rule or resolver code, registries, tests, or generated state. Keep a connected change under one owner or sequence it; parallelize batches whose write paths and real dependencies are independent. Do not build a formal graph for a small task. After an integration wave, note which proposals were accepted, conflicted, or created findings. Use that observed coupling to merge or split later batches; do not add agents when the accepted independent work is already the bottleneck.

**Before assigning a structural fix, inspect the constraints its proposed shape will encounter.** Read the relevant rule definitions/configuration and one accepted nearby pattern. For this analyzer, common collisions include:

| Proposed change | Check before editing |
| --- | --- |
| Extract helper/class/module | Minimum and maximum file/class/method size, method count, placement, directory limits, stateless/singleton rules, unused code, proxy methods |
| Replace repeated parameters with state or a request | Real ownership and lifetime, shared-parameter rules, fake-object/contract rules, constructor complexity and argument limits, mutability |
| Add factory, callback, observer, or registry | Static/factory restrictions, naming, inline/generic/union types, private access, forwarding layers, interface limits |
| Move constants/types or delete a wrapper | Existing domain modules, minimum size of both old and new files, import boundaries, remaining callers and exports |

Prefer an existing suitable owner/module over a new abstraction when both preserve the domain model. Do not create a helper that will predictably need another helper to satisfy adjacent rules. Do not add dummy methods, pad files, rename parameters solely to break grouping, or move behavior into a complex constructor to trade one finding for another. Preserve lifecycle, concurrency, traversal order, caching, and performance invariants where the fix touches them.

Choose a batch large enough to finish one ownership/API change, including callers, imports, obsolete types, and affected tests, but small enough to attribute its effects. Include already-visible companion findings in that scope. Fix directory/placement blockers before scattering work among their suppressed descendants. Do not pursue unrelated refactors or rule additions.

For an unfamiliar high-count transformation, validate one representative batch before applying the pattern broadly. Once it is proven, assign independent instances together instead of repeating a full project cycle per occurrence. Order work by likely verified reduction per unit time, dependencies, and risk; raw count alone is not priority.

## 3. Keep the coordinator and agents productive

The coordinator must have a concrete work item while implementation agents are active. After dispatching a batch, select the next useful task in this order:

1. Review a finished batch, reconcile its assigned findings, and run checks against its stable dependency scope. Return actionable corrections promptly so an agent does not wait for all peers.
2. Close a small independent file/finding group in a recorded coordinator-owned scope, including necessary caller/import cleanup; avoid starting a large refactor that delays integration.
3. Reproduce an unclear/false-positive finding, inspect the relevant rule and a nearby invalid case, and give the implementation owner evidence plus a minimal regression scenario.
4. Prepare the next independent batch from the existing inventory: verify its findings against current source, inspect adjacent constraints and callers, reserve write paths, and dispatch it when capacity permits. A new global scan is unnecessary merely to start unchanged independent findings.
5. Inspect an upcoming dependency, identify an accepted implementation pattern, or reconcile suppression/exposure causes. Record the result in the assignment or ledger, not a separate ceremonial report.

Track a coordinator task with a concrete deliverable alongside agent tasks (for example: `coordinator: reproduce shared-parameter case and prepare batch B; agent A: repair collector`). Read-only triage, reproduction commands, review, and validation are real coordinator work. Small implementation batches may be coordinator-owned under the role rules above; do not compete for an agent's files or invent busywork to claim activity.

Use a rolling queue rather than a barrier at the slowest agent. When a bounded batch is ready, review/check it and give its owner the next independent assignment. Gather ready batches into an integration checkpoint without requiring unrelated long-running work to finish first. For a global check on a shared worktree, arrange a brief no-write checkpoint after agents finish their current coherent edit; never measure partially written code. If an isolated checkout is already practical, it can provide stable checks without blocking other work; do not create isolation machinery for a tiny repair.

Local checks may overlap independent edits only when their actual inputs/dependencies are stable and output paths do not conflict. File paths being disjoint does not establish independence: project type checks, imports, rule registries and caches can couple them. Keep one heavy project-wide job active by default; allow independent lightweight checks when they do not contend materially. Record command, exit code, checked scope/snapshot, and stale dependencies. A local success is provisional until the integrated full run.

Each assignment states the checks the coordinator will run and their output paths. Agents request useful cheap checks with exact commands and continue independent inspection/editing while the coordinator runs them. Only the coordinator starts project/application/background processes or runs checks. Read-only inspection commands are permitted to agents under their assigned scope. Use supported scoped commands only; do not invent a partial type-check that loses project configuration. Return a local failure to the implementation owner for correction within its scope. Wait only when no independent task or useful stable check is available; state the specific dependency once and wait for an actual result rather than repeated status polling.

## 4. Implement and measure on a stable tree

Assign exact findings from a current snapshot, owned/prohibited paths, the chosen ownership boundary, collision risks, preserved behavior, expected resolved and potentially exposed findings, and the prohibition on project commands and checks. Require changed paths, unresolved findings, and any unexpected structural expansion in the return report. A new snapshot alone does not invalidate disjoint queued work: recheck its fingerprints and dependencies; reassign only what actually changed.

At each stable integration checkpoint for ready batches:

1. Review the diff and all changed callers/imports. Finish incomplete edits before measuring. A parse error or half-written file is a failed snapshot, not thousands of newly actionable findings.
2. Use the cheapest informative checks first. For mechanical/structural code cleanup, run necessary syntax/type checks and analyzer comparison before an expensive test sweep. For analyzer logic, traversal, resolution, cache or lifecycle changes, run focused semantic regressions early: a lost diagnostic can make a broken implementation appear clean. Obey repository-required ordering and user restrictions.
3. Run the same full-scope analyzer on the stable integrated tree. If a supported targeted mode is materially cheaper, use it for early feedback, but keep it explicitly partial and run the full scope at each integration wave before marking batches verified or assigning dependent work. A local scan cannot establish project-wide ownership/reference or directory effects.
4. Reconcile resolved, persistent, and newly observed fingerprints. Account for **introduced regressions**, **previously suppressed findings now exposed**, **authorized rule/scope changes**, and **invalid/stale runs** separately. Inspect the old code/raw inventory and suppression chain before attributing growth. If evidence is insufficient, label it unknown.
5. Record counts, changed group, check outcomes, and elapsed time for costly checks. Update the shared current-state file. In every user-facing checkpoint, include a compact Markdown table with `rule/group | previous | current | resolved | introduced/exposed | remaining`, then report checks and next work. State when a classification is provisional. Preserve original-baseline progress separately from the latest delta.

Choose tests by scope: component tests for local logic, component/system integration tests for changed boundaries, and system/acceptance tests for end-to-end requirements. Test level (scope) is separate from test type (functional, performance, security, regression, etc.); any type can apply at multiple levels. Prefer many fast, narrow tests and fewer broad tests. Run the smallest informative checks first, then required full gates at the final stable checkpoint.

Do not run a global analyzer after each trivial agent return when several independent batches form one stable wave. Do not run full tests, reviews, or performance benchmarks between cosmetic repairs unless required. Reuse passing checks only while their observed files, dependencies, and configuration remain unchanged. Run global checks at a coordinated stable checkpoint; if they overlap edits, revalidate the affected scope. Follow the coordinator work queue while agents implement or checks execute; a pending process is not a reason to stop other useful work.

## 5. Break growth–repair loops

A higher count can be valid exposure; a lower count can conceal regressions. Require a causal explanation, not monotonic decrease.

- **Introduced findings:** Return them to the same owner as part of the current batch. Before adding another class/factory/adapter, revisit the original ownership decision and adjacent rules. Prefer simplifying the proposed shape over building a repair layer around it.
- **Repeated failure of a shape:** If the same batch introduces fresh structural violations on two attempts, stop stacking repairs. Compare an alternative against the pre-batch diff and choose the smallest behavior-preserving design. Keep any selective reversion with the batch owner, or obtain an explicit handoff; preserve unrelated work. This triggers redesign, not abandonment of the zero goal.
- **Exposed findings:** Record the parent/blocker and continue from the updated inventory. Do not revert a valid fix just because lower-priority findings became visible. Group the exposed work by its actual cause.
- **Authorized rule/scope change:** Record a separate measurement segment with old/new policy and counts; do not present it as a cleanup regression or silently reset the original history. Do not initiate policy changes merely to obtain zero.
- **Invalid or unexplained run:** Resolve parse/config/cache/snapshot issues before dispatching repairs. Investigate cached/uncached disagreement only when evidence warrants it; do not routinely double every scan.

For analyzer false positives, require valid-code evidence and a regression containing both the formerly misreported valid case and a nearby invalid case that must still report. Do not weaken thresholds, disable rules, broaden ignores, or rewrite expected diagnostics to manufacture success. Narrow documented suppressions require explicit project permission and an intentional exception. Add behavior regression tests where the change merits them, not tests that merely mirror mechanical edits.

## 6. Verify and finish

Zero requires a fresh complete run of the exact requested analyzer scope on the final integrated tree, with no omitted paths or hidden findings presented as resolved. Run the required full test, type, formatting, and lint gates at the final checkpoint; rerun affected gates if later fixes change their inputs. A passing targeted test does not replace a required full gate. If a check is prohibited, unavailable, or failed, state which and leave that result unverified.

Report the baseline/final counts and scope, defects and analyzer false positives fixed, meaningful regression coverage, checks passed/not run and why, remaining findings/suppressions/uncertainty, and whether zero was reached. If nonzero, identify the largest remaining groups and next actionable batch. Never report success from a stale, partial, reduced-scope, or count-only result.
