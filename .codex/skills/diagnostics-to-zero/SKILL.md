---
name: diagnostics-to-zero
description: Reduce a project's lint or static-analysis findings to zero by triaging root causes, fixing real defects and false positives, adding focused regression tests, and verifying the integrated result without hiding diagnostics.
metadata:
  short-description: Resolve lint findings to zero
---

# Diagnostics to zero

Reach zero in the requested analyzer scope while preserving behavior, rule semantics, thresholds and coverage. Optimize elapsed time and model/tool round trips, not just the displayed count.

## Ownership

Use the latest complete canonical inventory to choose execution mode. **If fewer than 10 files are affected OR at most 30 diagnostics remain, the coordinator implements all remaining repairs itself; do not spawn agents or send new implementation assignments.** The condition is `affected_files < 10 || remaining_findings <= 30`, not both. Apply it at baseline and after every measured integration checkpoint. Use full counts, including deferred findings, not a selected batch. If the inventory is incomplete, obtain it before choosing the mode.

When a delegated run crosses this threshold, stop new assignments, collect already-active batches or obtain an explicit stop/handoff, reconcile their partial changes, then finish directly without overlapping agent scopes. Keep existing agents open unless the user asks otherwise. Above both thresholds, delegate substantial repairs with a real assignment: snapshot/findings, bounded write paths, dependencies and acceptance criteria. **Cap each agent's active assignment at 100 findings from the complete canonical inventory, including deferred findings.** Keep the total of an agent's active and queued findings at or below 100. Split larger owner clusters into caller-complete, non-overlapping batches of at most 100; order dependent batches and dispatch the next only after that agent reaches a no-write handoff and the prior batch is reconciled. Do not evade the cap by bundling multiple batches into one assignment. Use all available agent slots for independent ready batches, up to the configured concurrency limit. Account for the coordinator occupying a slot; with four total slots, at most three child agents can run. Keep one ≤100-finding packet per agent and refill a slot as soon as its prior packet is handed off and reconciled. The coordinator also claims and closes an independent packet of up to 100 baseline findings when feasible; record it and keep it disjoint from delegated scopes. Agents implement directly without recursive delegation. The coordinator may close small understood files/findings in its own recorded scope; do not take over active agent files without a handoff. If delegation is unavailable, continue eligible small independent fixes and report blocked larger batches.

**Implementation agents may read project files and edit their assigned write paths.** If direct file tools are unavailable, they may use shell commands for source inspection (`rg`, `sed`, `cat`) and scoped edits (`apply_patch`). They may read other in-root files needed to understand their findings, but must not edit outside assigned paths. Agents must not run Git commands, tests, scripts, syntax/type/lint checks, formatters, builds, project CLIs, package installation, network operations or background jobs, directly or indirectly. The coordinator executes checks and owns validation. Preserve unrelated changes and existing user restrictions. Keep agents open unless the user asks otherwise.

Read [references/agent-protocol.md](references/agent-protocol.md) when assigning work. These ownership rules concern diagnostic repairs, not analysis or skill editing.

When the analyzer supports native `--agents N` task packages, read [references/agent-packages.md](references/agent-packages.md) and use its generated package manifest as the source of assignment boundaries. `--agents` creates report packages; it does not itself start Codex agents. Keep its file-capacity semantics separate from the skill's per-agent finding cap.

## One baseline and one source of truth

Read repository guidance and inspect the branch/worktree. Identify the exact analyzer command, configuration and scope. Unless narrowed by the user, zero includes every reported severity. Capture command/exit status, revision/worktree fingerprint and a complete machine-readable inventory. Reuse an existing report only if its target, source snapshot, command, configuration and scope match; a timing summary is not an inventory.

Distinguish total analyzer findings, suppressed/deferred findings and the selected repair batch. Neither `issues.md`, a large batch size nor a flag named `all` establishes completeness. Resolve the extraction method once and reuse it. Where available read the per-file fix plan and suppression causes. Never reconstruct totals by manually adding overlapping Markdown sections.

Maintain one compact `.ai-code-guard/work-status.md`; read [references/work-status.md](references/work-status.md) at setup or resumption. Derive all tables from the same report snapshot; show the last measured count as stale after edits, without inventing a new count. Preserve the original baseline separately from the latest delta. If only a partial inventory exists, say so and resolve that gap before complete accounting.

For supported JSON reports use `python -m scripts.diagnostics_to_zero.diagnostic_summary_command <current.json> --compare <previous.json>`. Fingerprints based on rule/path/message are aids: reconcile moved symbols, changed wording and duplicates against source. Do not call their churn verified resolution.

## Choose a complete bounded repair

Classify findings as confirmed defects, expected changes, false positives or unclear. Group by root cause/owner, including callers, imports, obsolete contracts and relevant tests. Sequence batches sharing APIs, rules/resolvers, registries or fixtures; disjoint write paths alone do not establish independence. Fix directory/placement blockers before scattering work among suppressed descendants. Validate one representative unfamiliar transformation before wider rollout.

Use the analyzer's existing priority as both severity and repair order; do not add a second triage scale. First clear directory findings that suppress descendants, then file location/placement/naming findings that suppress content, then work top-down from broad contracts and architecture to local behavior and style. After each structural wave, refresh the report before assigning newly exposed findings. When package capacity forces omissions, retain higher-priority eligible work and leave excluded findings explicitly open for later waves.

Before structural edits, read [references/repair-design.md](references/repair-design.md) for adjacent-rule collisions and analyzer regression cases. Prefer accepted existing owners over thin wrappers or new abstractions that move violations. Do not pad files, add dummy methods, rename solely to break grouping, weaken rules, broaden ignores or change thresholds to manufacture zero. Narrow intentional suppressions require project permission.

If a design produces new structural violations on two attempts, stop layering fixes: inspect the complete ownership/API/caller boundary and choose one simpler design with one owner. Preserve unrelated work during any selective reversion. A higher count can expose valid suppressed findings; a lower count can hide broken analysis. Separate introduced, exposed, policy/scope changes and invalid/unknown results with causal evidence.

## Active coordinator, fewer round trips

While agents implement or a process runs, the coordinator reviews ready work, closes small independent findings, reproduces unclear cases, or prepares the next bounded assignment. Record its concrete next task. Keep all available child-agent slots occupied with independent ready packets within the 100-finding active-plus-queued cap, accounting for the coordinator’s slot, and refill a completed slot without waiting for the slowest agent. Do not split caller-coupled changes across simultaneous writers unless the shared API and migration order are explicit. If nothing useful is independent, wait rather than inventing busywork.

For long commands use an initial wait/poll of roughly 10–30 seconds; avoid repeated one-second polling. Agent waits should be event-driven or typically 30–60 seconds, respecting communication/tool limits. Inspect output on completion or a meaningful progress boundary; do not repeatedly reread unchanged reports or query unchanged agent status. Keep one heavy project check active by default.

Read narrow source/diff ranges and filtered findings. Save full check output to existing artifacts where possible; return exit status, totals and failing excerpts to the model rather than successful test listings or full reports. Do not reload the whole skill after each batch; on resumption read current status and only missing relevant guidance.

## Validate stable checkpoints

Validate ready batches without waiting for unrelated long work, provided checked dependencies are stable. Arrange a short no-write checkpoint for global checks. Never interpret a partially written tree as a new actionable inventory.

1. Review the complete diff/callers. Before any test or full analyzer pass, the coordinator runs the cheapest supported **syntax/parse check on changed source and tests**. Check files exist before passing paths to a runner. If syntax fails, repair it first; recovery-generated thousands of findings are invalid for triage. If no isolated parser is available, use the cheapest existing check that detects syntax errors; do not invent new infrastructure.
2. For shared analyzer/resolver/traversal changes, run focused semantic regressions before trusting any count reduction. For mechanical edits, use cheap applicable static checks first. Follow required repository ordering and user restrictions.
3. Keep a compact check ledger: command, input/dependency fingerprint, scope, exit status and result. Reuse passing checks when relevant inputs and dependencies remain unchanged. A typo in one test path requires running the corrected missing test, not every passing suite again. A type-only import fix requires rerunning the affected static gate; rerun execution tests only if execution/dependencies changed. Preserve explicitly required full checks.
4. Run one canonical full analyzer per stable integration wave, not per trivial edit. Targeted scans are early feedback only. Reuse a complete same-snapshot final runner report instead of another equivalent scan. Compare fingerprints and explain material new findings before marking a group verified.
5. At the final stable checkpoint run required full tests, types, formatting and lint. Do not repeat an entire full runner to fix a single downstream gate unless repository guidance requires it or earlier gates' inputs changed. After autoformatting or any other mutation, revalidate affected inputs/gates.

Update current status at measured checkpoints and meaningful ownership/phase changes. User-facing measured checkpoints show one compact table: `rule/group | previous | current | resolved | introduced/exposed | remaining`, then checks and next work. Use unknown where reconciliation is incomplete. Between checkpoints give short meaningful updates as required, without repeating unchanged tables or closed-review counts. On a status request report the latest measured table immediately, identifying snapshot/staleness.

## Finish honestly

Zero requires a fresh complete canonical-scope analyzer result on the final integrated tree, with no hidden/omitted findings treated as resolved. Report baseline/final counts, scope/command, meaningful defect/false-positive fixes and regression coverage, check results, remaining findings/suppressions/uncertainty and whether zero was achieved. Distinguish prohibited, unavailable and failed checks. If nonzero, name the largest remaining groups and the next bounded action. Never claim success from a stale, partial or count-only report.
