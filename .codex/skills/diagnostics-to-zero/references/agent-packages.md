# Native diagnostic packages

Use this workflow when the analyzer provides `--agents N` and writes package/task files. In this repository, the command is `pnpm lint --policy all --agents N --batch-size B`; use the project's documented equivalent elsewhere. `--agents` generates packages and does not start Codex agents.

## Plan one wave

1. Capture the complete canonical inventory and its source snapshot. Choose `--policy all` when the goal is zero across the analyzer scope; use a narrower policy only when the user explicitly narrowed the repair scope. Record visible, suppressed, deferred, and policy-selected counts separately.
2. Choose `N` from the child-agent slots actually available for this wave, accounting for the coordinator's slot and the skill's ownership threshold. Do not request more packages than can be assigned promptly. `--agents 1` is a valid single-package mode. If the coordinator must own the work directly, do not dispatch generated packages to new implementation agents.
3. Set `B` as the maximum number of distinct files per package. It is never a finding limit. Count production and resolver-linked test files toward `B`; keep linked production/test scopes together. Test findings may be ignored for balancing priority and load, but their files still consume capacity. A package can therefore contain more findings than files.
4. Generate packages from the same selected inventory and snapshot. Prefer the analyzer's native directory/file scopes and ownership history: keep a still-dirty folder with its prior package number where possible, let clean folders release ownership, and keep package scopes disjoint. Do not hand-repartition generated scopes based only on finding counts.
5. Read the generated summary and every package before dispatch. Check the requested and created package counts, distinct file count per package, linked test membership, scope overlap, and finding coverage. Reconcile the package finding IDs (or stable path/rule/location keys) against the canonical selected set. For a nonempty selected set, require at least one nonempty package. Treat any missing, duplicate, malformed, or unaccounted finding as a planner/reporting defect; do not call it resolved.

The planner may create fewer than `N` packages when the minimum package size, linked scopes, or file capacity make `N` infeasible. It may also exclude findings when aggregate file capacity is exhausted. In that case, higher-priority eligible findings should be retained first; list the excluded findings as open work for the next wave. Findings omitted from packages remain in the full report and count toward the skill's ownership threshold. Do not silently discard them or create tiny packages just to reach `N`.

## Assign and integrate

- Use each generated package as a file-scope boundary, then create a caller-complete assignment with the exact finding IDs, snapshot, dependencies, owned/prohibited paths, and acceptance criteria. Apply the separate cap of 100 canonical findings to each agent's active-plus-queued assignment; `B` does not replace or imply this cap. If a generated package exceeds 100 findings, sequence non-overlapping finding subsets within that package and reconcile each handoff before sending the next subset to the same agent.
- Keep shared APIs, resolvers, registries, or fixtures under one owner or sequence their changes. Do not dispatch two packages that touch a shared write path simultaneously, even when their reported directory scopes do not overlap.
- Generated package directories may be replaced atomically on rerun. Before regenerating, get a no-write checkpoint from active owners and reconcile their diffs. Do not make in-flight agents depend on task files that a new planning run may replace.
- After a stable integration wave, run one fresh complete inventory and regenerate once from that snapshot. Reuse unchanged package ownership and passing checks; reassign only changed or newly exposed work. Do not rerun the full analyzer merely to check agent progress.
- When the selected set is empty, no packages are expected. When packages are complete but capacity exclusions remain, the overall task is not complete; assign the next wave from those still-open findings.

## Priority-led order

Use the analyzer's one existing priority scale for both severity and work order. Do not create a separate triage score. Resolve structural blockers in hierarchy order: directory ownership/structure first, then file location/placement/naming, then broad contracts and architecture, followed by local behavior, size, style, and wording. A directory finding that suppresses descendants takes precedence over those descendants; a file organization finding takes precedence over content findings for that file. Refresh the canonical inventory after these changes because previously hidden findings may become visible.

When packages have more work than capacity, retain higher-priority eligible production findings first, while keeping linked tests with their production scope. Balance the work across packages only after respecting structural prerequisites, linked scopes, file capacity, shared ownership, and stable folder assignments. Do not split a high-level cause among agents simply to equalize raw finding counts. Within an equal-priority tier, prefer coherent owner/API groups and similar file loads; preserve existing package numbers before optimizing small balance differences.

## Session-derived improvements

The recent integration exposed two costly failure patterns: a partition once omitted two selected findings, and several agents needed repeated handoffs to clarify scope/capacity. The planner's coverage and stability regressions now cover the omission, `--agents 1`, nonempty output, linked scopes, over-capacity groups, and stable ownership. Preserve that evidence by validating the generated artifact before dispatch and assigning directly from its manifest. Recent priority changes also left stale numeric expectations in tests and reports; when a priority changes, update rule-level expectations and visible-report suppression tests in the same change, then run the full required validation once on a stable tree.
