# Agent protocol

Check the latest complete inventory before delegating: if affected files < 10 OR remaining diagnostics <= 30, the coordinator closes all remaining work directly with no new agent assignments. Count deferred findings too. On crossing the threshold, collect active work or obtain stop/handoff before taking ownership. Above both thresholds, delegate substantial repairs; the coordinator may own small independent fixes. One owner per coherent scope. Agents implement directly without recursive delegation. Agents may read project files and edit only assigned write paths. If direct file tools are unavailable, allow shell for reading files (`rg`, `sed`, `cat`) and applying scoped patches (`apply_patch`); related in-root files may be read for context. Agents must not run Git, tests, scripts, syntax/type/lint checks, formatters, builds, project CLIs, package installation, network operations or background jobs. The coordinator runs checks and owns validation.

## Assignment

Send a filtered inventory with snapshot, finding IDs/count, root cause/evidence, owned/prohibited paths, real dependencies, intended owner/API, adjacent-rule constraints, preserved invariants, coordinator-run checks and expected deliverables. Include callers/imports/obsolete types/fixtures needed to finish the change. Keep shared infrastructure under one owner or sequence it. Do not send the entire skill or full project report when a scoped assignment suffices.

Require changed paths, handled/unresolved findings, tests added, unexpected expansion and check requests. Agent-estimated resolution is provisional until measured. Report overlap/ambiguity immediately; send a useful progress update for work exceeding fifteen minutes. Do not send routine heartbeats. Keep agents open unless the user requests otherwise.

## Rolling integration

Keep assignments and the coordinator's own next task in the existing shared status file. Review finished batches promptly and refill independent capacity. New snapshots do not invalidate unchanged independent assignments. Do not wait for all agents to inspect a ready stable area; do not check dependencies still being edited.

Before a global check arrange a short no-write checkpoint. The coordinator checks changed-file syntax and test-path existence before expensive checks, reuses passing checks on unchanged dependencies, and compares a complete fresh inventory at each integration wave. Save verbose logs outside model output and send only concise results/failing excerpts. Agents correct failures within their scope.

Use event-driven or 30–60-second agent waits instead of repeated polling. Before transferring active work, obtain stop/handoff and reconcile the partial diff. Never edit another owner's scope concurrently. If a structural approach creates new violations twice, revisit the whole owner/API boundary using `repair-design.md` rather than stacking repairs. Preserve unrelated changes.

Report measured deltas and new causes, not repeated unchanged totals. Mark verified only after complete inventory reconciliation; types, targeted scans and agent reports alone are insufficient.
