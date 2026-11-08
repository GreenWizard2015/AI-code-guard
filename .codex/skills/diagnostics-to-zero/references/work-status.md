# Shared work status

Keep one compact current-state file at `<linter-workspace>/.ai-code-guard/work-status.md` when a task spans diagnostics and performance work. Update it in place; do not copy full reports, benchmark tables, or attempt histories into it. Detailed evidence remains in the existing inventories, diagnostic logs, and performance snapshots.

Use this shape, omitting fields that do not apply:

```markdown
# Current work

goal: <requested outcome>
target: <absolute target path>
linter_workspace: <absolute implementation path>
source_snapshot: <revision + worktree fingerprint>
scope: <command, configuration, analyzed paths>

timing: <unmeasured|active|passed|failed> — <candidate score / accepted threshold / measurement ID>
correctness: <unverified|active|passed|failed> — <checks and snapshot>

diagnostics_source: <report path + report snapshot ID, or unavailable>
diagnostics_scope: <command/configuration/scope fingerprint>

| Rule/group | Previous | Current | Resolved | Introduced/exposed | Remaining | Owner/status |
|---|---:|---:|---:|---:|---:|---|

| Batch | Findings/root cause | Owner | Write paths | Coupled to | State/next check |
|---|---|---|---|---|---|

next: <single concrete action>
```

Report `diagnostics_source=unavailable` when only an issue count or timing summary exists. A report is reusable only when its target, source snapshot, exact command/configuration, scope, and report contents still match. If any differ, capture a fresh complete report and update this file. Do not make another full lint pass solely to recreate a summary already available for the exact integrated snapshot.

At each measured user-facing diagnostic checkpoint, render the rule/group counts as a compact table with before/current, resolved, introduced/exposed, and remaining values. The status file is the source of truth for the current phase; preserve original-baseline progress in the detailed append-only task log.

For parallel batches, list only real coupling that affects acceptance: shared files, APIs/callers, rules/resolvers, registries, tests, or generated state. Keep coupled batches under one owner or sequence them. After integration, record accepted, conflicted, and regression-producing proposals; use those observations to choose the next batch boundaries. Do not run extra checks solely to calculate a parallelism metric.

Keep a compact check ledger in this same file: command/check ID, relevant input and dependency fingerprint, covered scope, status, and next invalidating change. Store verbose output in existing check artifacts, not here. Use it to rerun only affected checks; retain final mandatory gates. Update counts exclusively from the canonical complete report. Selected and deferred counts are separate metadata, never competing totals. Do not rewrite status or repeat a full table when nothing changed.
