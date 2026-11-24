---
name: diagnostic-cycle-audit
description: Find realistic cases where ordinary diagnostics-to-zero repairs cause an earlier semantic lint problem to return within two to five repair steps. Uses an isolated project copy and a repair agent that is not told to create a cycle; reports reproducible cycles without changing the linter.
metadata:
  short-description: Find diagnostic repair cycles
---

# Diagnostic repair-cycle audit

Find realistic initial code whose normal repair path under `$diagnostics-to-zero` recreates the same underlying lint problem after 2–5 completed repair-and-lint steps. Treat a cycle as an emergent conflict in rule guidance, priority/suppression, or adjacent-rule behavior—not as an agent intentionally alternating edits. Discover and report; do not fix linter rules unless the user separately asks for fixes.

## Isolation and participants

Use the current session workspace as the project; do not ask for its path again. Keep the original tree read-only. For each attempt, create a fresh temporary project copy. The copy may contain the repository's `$diagnostics-to-zero` skill, but remove this audit skill and its attempt notes from the copy so the repair agent cannot read the audit instructions. Put fixture code and temporary logs only in the copy. Persistent findings belong in the original project's `.ai-code-guard/diagnostic-cycles.md`, append-only.

Use one coordinator and one repair agent at a time. Launch the repair agent with a clean context (`fork_turns: none` or equivalent); give it only the temporary project path and an ordinary request to resolve its lint diagnostics to zero using `$diagnostics-to-zero`. Do not mention cycles, recurrence, adversarial testing, target rules, or the expected repair path. Do not seed hints in task files, code comments, issue descriptions, or project instructions. The agent must receive enough truthful context to do ordinary repair work, but no audit objective. Never run two lint invocations concurrently.

The repair agent works only in its temporary copy and follows `$diagnostics-to-zero` normally. The coordinator observes its ordinary repair checkpoints and runs or reads the corresponding complete lint inventory after each stable handoff. Do not steer the agent toward an intended sequence. If the agent asks a necessary scope question, answer only what is needed to complete ordinary diagnostics-to-zero work; record the question and answer.

## Search workflow

Read `.ai-code-guard/diagnostic-cycles.md` and existing diagnostic/rule test inventories before choosing a candidate. Avoid repeating already confirmed mechanisms. Trace each candidate diagnostic from rule registration through its actual analysis and suppression path. Prefer realistic rule interactions where fixing one finding can expose or cause another: size and placement constraints, parent/child suppression, structural refactors, linked production/test organization, or a shared owner/API boundary. Do not assume a conflict from rule names alone.

For each attempt:

1. Make a fresh temporary copy of the workspace. Exclude `.git`, dependencies, generated output, and stale reports; do not use `.gitignore` to narrow the source under audit. Preserve project source, configuration, tests, and `$diagnostics-to-zero` instructions. Remove only the diagnostic-cycle audit skill and audit-only notes from the copy.
2. Create a minimal, ordinary, valid-code fixture in a path the analyzer actually scans. Verify the fixture is included and produces the intended initial finding in a complete baseline inventory. Keep unrelated findings out of the fixture's way where practical; record any baseline findings that remain.
3. Start the uninformed repair agent with the ordinary diagnostics-to-zero request. Let it choose and implement fixes using the existing rules and guidance. Do not tell it to add, preserve, or recreate diagnostics.
4. At every stable repair handoff, record the changed paths and full diagnostic inventory. Compare the semantic cause of the initial finding against current findings, including newly exposed findings after structural changes. Count one step for each completed repair batch followed by a fresh complete lint inventory—not for every individual file edit.
5. Confirm a cycle only if the same underlying problem as the initial finding returns after 2, 3, 4, or 5 completed steps. The rule ID may be the same, but require matching semantic evidence and source behavior; the same rule on an unrelated line or file is not recurrence. Save the minimal initial fixture, each intermediate change/inventory, and the final recurrence evidence.
6. If the repair agent reaches zero, or the initial problem does not return within five steps, finish the attempt as no-cycle-found. Do not manufacture a recurrence by editing the linter, configuration, thresholds, ignores, or the repair agent's work.

After a positive finding, ask the repair agent to stop writing at a normal checkpoint, reconcile the temporary diff and inventories, then end that attempt. The agent must not patch the linter. Keep the original workspace unchanged. Start the next attempt from another fresh copy and a different untested mechanism. A no-cycle attempt is complete but is not evidence that the search is exhausted. Continue with independent candidates; every six attempts, return a compact package of confirmed cycles and completed negative attempts, then continue with the next series unless the user asks to stop or pause.

## What counts as a cycle

A reportable cycle must satisfy all of the following:

- The initial fixture is realistic, valid user code and is discovered by the actual analyzer configuration.
- The repair agent was asked only to resolve diagnostics normally and was not told to create a cycle.
- Each transition is an ordinary repair supported by the diagnostic message, rule documentation, or the project's `$diagnostics-to-zero` workflow.
- The same semantic lint problem present at baseline reappears after 2–5 stable repair-and-lint steps.
- Complete inventories and source diffs establish the chain. A stale count, partial report, unrelated same-rule finding, invalid parse recovery, changed configuration, or deliberate oscillation does not qualify.
- The underlying cause is actionable in a rule, suppression/priority design, diagnostic guidance, or shared analyzer logic.

If a separate rule already detects and blocks the same semantic problem, report a cycle only when the original issue is genuinely reintroduced and actionable; do not count duplicate wording or a harmless alternate diagnostic as recurrence.

## Recording and handoff

Append every attempt to `.ai-code-guard/diagnostic-cycles.md`; never truncate or regenerate prior history. Keep detailed temporary reports and diffs under the temporary copy's `.ai-code-guard/`. Record exact lint commands, exit statuses, source snapshots, repair-step boundaries, and diagnostic IDs. For positive cases include:

- attempt number and initial diagnostic/rule;
- the minimal initial fixture and its baseline finding;
- the repair agent's uninformed task prompt (without hidden audit instructions);
- each step's changed paths, diagnostic delta, and relevant source excerpt;
- the step where the original semantic problem returned and evidence that it is the same problem;
- the rule guidance or analyzer behavior that made each repair reasonable;
- related rules and tests that should be checked when the user asks for a fix.

Use this compact summary per attempt:

```text
attempt=2
status=cycle-found|no-cycle-found|invalid-fixture|blocked
initial_rule=<rule ID>
steps=<2..5, or 0 if none>
cycle=<semantic finding and recurrence step, or none>
evidence=<temporary report/diff paths>
next=<next independent mechanism or handoff>
```

Do not edit or commit the original project as part of the audit. The final response separates confirmed cycles, completed no-cycle attempts, invalid attempts, and unresolved uncertainties. A zero-finding lint result is not a successful cycle; it is a completed negative attempt.
