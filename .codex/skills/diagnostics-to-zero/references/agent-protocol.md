# Agent protocol

Delegate substantial diagnostic implementation under `../SKILL.md`; the coordinator may directly handle recorded small independent batches. The coordinator owns the inventory, architecture, integration, checks, and final outcome; assigned agents implement their bounded batches directly without recursively delegating.

## Assignment

Use a current complete snapshot. Assign a coherent repair including affected callers, imports, obsolete contracts, and relevant tests; disjoint ownership is required for parallel edits. Keep shared rule registration, dispatch, AST/context, configuration, and cross-cutting infrastructure with one assigned owner. If a required file is outside scope, the agent reports the dependency before editing it.

Send a filtered inventory, not the whole report, using this template:

> **Goal/evidence:** root cause, snapshot ID, exact findings/fingerprints and count.
> **Own / do not edit:** bounded paths and shared dependencies.
> **Design:** intended owner/lifetime, accepted nearby pattern, adjacent rule constraints, expected resolved findings and possible exposed descendants. Prefer existing owners; avoid new thin wrappers, factories, or request objects that merely move violations.
> **Preserve:** behavior, rule coverage/thresholds, and applicable lifecycle, concurrency, traversal, cache or performance invariants.
> **Commands:** agents may use read-only shell commands (`cat`, `sed`, `rg`, `ls`) to inspect their assigned files and use patch/file-editing tools for their owned paths. Do not run project code, tests, syntax/type checks, lint, formatters, Git commands, scripts, or background jobs. Request a necessary check from the coordinator with the exact command, purpose, inputs and expected outputs; only the coordinator runs checks.
> **Return:** changed paths, assigned findings handled/unresolved, regressions suspected, tests added, checks actually run, dependencies, and next step. Do not claim verified resolution without a current analyzer result.

Confirm scope before edits. Report overlap, ambiguity, unexpected architecture expansion, or inability to preserve behavior immediately. For work exceeding fifteen minutes, send a useful midpoint update: handled, remaining, blocked, new risks, and next action. Do not spend the interval building an unrequested framework.

## Coordination

Maintain one coordinator-owned ledger: snapshot, finding/group, owner, paths, status (`queued`, `active`, `ready`, `integrated`, `verified`, `blocked`), remaining findings, and next action. Each batch has one recorded owner. Agent batches require a successful real assignment; small independent batches may be coordinator-owned with exact findings and write paths. Reuse agents and assign precise follow-up work. Do not take over an active agent's edits without an explicit handoff.

A refreshed snapshot does not automatically invalidate independent work. Recheck queued findings and dependencies; cancel or amend only assignments actually affected by intervening changes. An agent finding someone else's issue reports evidence rather than editing that scope.

Record a concrete coordinator task alongside active agent tasks. Follow the work queue in `SKILL.md`: review/check ready work, close small coordinator-owned files/findings, reproduce unclear findings, prepare and dispatch independent next batches, then resolve upcoming constraints and dependencies. Attach the useful result to the ledger or assignment. Do not mark the coordinator busy merely because it is waiting on a process.

The coordinator runs all checks and project commands. Agents may use read-only inspection commands under their assigned scope and request useful checks with exact commands, scope and expected outputs, then continue independent inspection/editing. The coordinator returns command, exit code, scope/snapshot and output location; agents correct failures within their assigned scope. Avoid rerunning passing checks on unchanged inputs/dependencies, but still verify integrated behavior. Never bypass the check restriction through another tool or agent.

Review finished work without waiting for every peer. Refill available agent capacity with independent prepared work; do not start a full scan merely because one trivial batch returned. For shared-tree global checks, request a brief no-write checkpoint after coherent edits; for scoped checks, verify actual dependency and output independence. Default to one heavy project job, allowing cheap independent checks. A long batch must not block review and scoped validation of unrelated finished work.

Ask for a status update only when a useful agreed checkpoint is missed or a dependency needs clarification; avoid repeated polling. Before transferring an active batch, obtain the old owner's stop/handoff and reconcile its partial diff, so two agents never edit the same scope. Keep agents open unless the user requests otherwise.

## Integration waves

Collect ready batches into a stable checkpoint; a wave need not include every active agent. Review diffs and run checks at the cost appropriate to the change, as described in `SKILL.md`. Use one full analyzer comparison per coherent wave; do not repeat it per trivial return. Shared infrastructure changes require early semantic regression checks and a full inventory refresh before dependent assignments.

Reconcile every assigned fingerprint against the fresh full report before marking verified. Separate introduced regressions from exposed descendants and scope changes. Send regressions back to the same owner as part of the repair. If the design creates fresh structural violations twice, pause layering and assign a simpler alternative or a selective reversion of only that batch's edits. Never overwrite unrelated user changes.

Report starting/current totals, resolved/introduced/exposed/unknown counts, remaining groups, checks, and next step. Distinguish estimates from measured results. Completion reports, partial scans, and passing types alone do not prove a batch is fixed.
