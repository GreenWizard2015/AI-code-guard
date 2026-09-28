---
name: find-bypass
description: Find and close realistic linter bypasses with an isolated audit agent, shared resolver fixes, regression tests, and persistent attempt reporting.
---

# Linter bypass search algorithm

The goal of this skill is to find realistic ways to write valid code that
evades a project rule, then close the whole underlying pattern rather than only
the discovered example. Search all linter rules; do not focus in advance on
aliases, types, one language, or one subsystem.

## Required target argument

The skill takes one required argument, `target_project_path`: the absolute path
to the project being audited. Use the path supplied by the user; never silently
replace it with the current working directory.

For an invocation written as:

```text
$find-bypass /absolute/path/to/target-project
```

interpret the positional value as `target_project_path`. Validate that it is an
existing directory before starting. Keep it separate from the linter workspace
that contains this skill. If the argument is missing, ask for it rather than
auditing an implicit directory.

All fixtures, reports, and temporary copies must be scoped to
`target_project_path`. Never modify the target project while searching for a
bypass; fixes belong to the linter workspace unless the user explicitly
requests changes to the target.

## Participants and boundaries

Use one primary agent and one temporary audit agent.

The temporary agent receives a fresh copy of the project in a dedicated
temporary directory. It may:

- read linter source code, rules, resolvers, and tests;
- read the code being checked;
- create small fixtures, drafts, and reports in its temporary directory;
- run the linter against those fixtures.

The temporary agent must not:

- modify the original project, linter source, tests, configuration, or
  documentation;
- use `gitignore` to narrow the search or assume that an ignored file is out of
  scope;
- make changes in the shared working copy;
- fix a discovered bypass itself.

Exactly one linter run counts as one attempt. Every report must state the
attempt number explicitly, for example `attempt=4`.

The temporary agent must report progress during the audit, not remain silent
until the final handoff. At the start and end of every attempt, report the
attempt number, selected rule or pattern, fixture status, linter-run status,
finding count, and the next action. During a long AST or resolver analysis,
send an intermediate status at least every 60 seconds. Progress reports must
not modify the shared workspace or reset the attempt counter.

## Preparing the copy

Before the first attempt and after every fix, the primary agent creates a fresh
copy in the temporary directory. Remove only external artifacts that are not
the subject of the audit: `.git`, dependencies, build output, coverage data,
and the report directory itself. Do not copy or read `.gitignore` from the
temporary agent.

The temporary agent always works in this copy, never in the shared working
directory. After a fix, do not continue with the old copy: it may repeat a
closed bypass or miss the new implementation.

The file `lint-bypass-findings.md` is append-only audit history. Read it before
every attempt, preserve every existing line and finding, and append new
attempts or generalized patterns below the existing content. Never truncate,
rewrite, reset, replace, or regenerate this file, including after a fix, a
fresh copy, a zero-finding attempt, or a reporting checkpoint.

## One attempt

Perform every attempt completely:

1. Read the rules and the existing `lint-bypass-findings.md` so already closed
   bypasses are not repeated.
2. Select a rule or a related group of rules. Do not stop at the first obvious
   location; also inspect rules that use the same AST node, resolver, or source
   model.
3. Find a boundary where the rule may lose information: AST depth, scope,
   condition, expression wrapper, alias, type, structure, list, object
   property, index, import, inheritance, or traversal order.
4. Build a minimal fixture from ordinary user code. It must be syntactically
   and type-correct to the extent required by the project.
5. Run the linter exactly once for this attempt.
6. Compare the expected diagnostic with the actual output and verify that a
   missing diagnostic is caused by a bypass, not by a broken fixture or run.

If no bypass is found, the attempt is still complete. A zero result is never a
reason to stop after the first run. Immediately start another independent
attempt, increment `attempt`, and report the new finding count. With
`findings=0`, the temporary agent must not sleep or finish the audit.

## What counts as a bypass

Accept a finding only when all of these conditions hold:

- the code is realistic for a project user;
- the bypass takes at most three consecutive user-code changes or steps;
- the rule should report a violation by meaning, but does not report it;
- the cause is reproducible in a rule or shared resolver;
- it does not require changing the linter, replacing its configuration,
  breaking the parser, using an impossible type, or relying on unavailable
  environment state;
- it is not the same violation already guaranteed to be caught by another rule;
- it is not a purely theoretical syntax combination with no practical meaning.

If another rule already covers the problem, do not register it as a new
finding. If coverage is partial, describe only the uncovered part and check
whether the shared source model can close it for both rules.

## Required analysis depth

Do not inspect only the immediate AST parent or only `source_file.statements`.

For every relevant rule, check:

- every AST nesting depth;
- functions, methods, arrow functions, IIFEs, classes, namespaces, and blocks;
- conditions inside calls, properties, indexes, spread elements, arrays,
  objects, conditional expressions, and logical chains;
- expressions under `!`, parentheses, `Boolean(...)`, `as`, `satisfies`,
  non-null assertions, and other transparent wrappers;
- local scopes and function boundaries;
- declarations, assignments, imports, and alias chains.

Inspect conditions at every level of the condition tree, not only at the direct
`if` expression. Apply the same generalization to every rule that analyzes a
condition or its container.

## Aliases, types, structures, and lists

When a bypass involves an alias, resolve the entire value path instead of
adding a check for the fixture's particular name.

When applicable, a resolver must support:

- direct names and name chains;
- object and array destructuring;
- object properties, shorthand, computed keys, and spreads;
- string and numeric indexes;
- assignments and imported names;
- local scopes and shadowing;
- type aliases, qualified names, generic wrappers, and inheritance;
- nested structures and lists of values;
- cycles and visited nodes without infinite recursion.

Do not close only the name `Reflect`, `Object`, `Boolean`, one concrete type,
or one access form. When a value source is found, the fix must cover direct
access, aliases, container properties, indexes, and equivalent structures
where they have the same meaning.

After a finding in one rule, inspect every other rule that uses the same
resolver, AST traversal, or alias model. Prefer shared fixes over local
exceptions.

## Recording a finding

After finding a bypass, the temporary agent must not fix it. It records:

- the attempt number;
- the bypassed rule or generalized pattern;
- the minimal working bypass code;
- the expected diagnostic;
- the actual linter result;
- why the current AST traversal or resolver missed the code;
- related rules that must be checked with the same pattern.

Use this compact report format:

```text
attempt=3
findings=1
pattern=AST-depth/object-alias resolution
fixture=<minimal code>
expected=<diagnostic that should exist>
actual=<lint output>
reason=<missing traversal or resolution step>
```

For an in-progress status, use:

```text
attempt=4
status=in-progress
pattern=<rule or generalized pattern under analysis>
fixture=<not-started|ready|executed>
lint_run=<not-started|running|completed>
findings=<count so far>
next=<next analysis or verification step>
```

Before `attempt=6`, a positive finding is appended to the current package and
the temporary agent continues searching; it does not sleep or wait for an
individual fix. The temporary agent must not modify the shared project or
claim that a bypass is closed merely because it created a fixture. Only the
complete `attempt=6` package puts the agent to sleep.

## Six-attempt reporting cycle

Run attempts in order and append each result to `lint-bypass-findings.md`:

1. Attempts 1–5: search different rules or patterns. Do not fix or sleep.
2. Attempt 6 with findings: return one package containing all findings from
   attempts 1–6, then sleep and wait for the primary agent to fix the package.
3. Attempt 6 without findings: continue with attempt 7.
4. After the package is fixed, refresh the copy and restart at attempt 1.

Never start another attempt while a positive attempt-6 package is awaiting a
fix. Never clear the findings file. Continue these cycles until the user
explicitly asks to stop or pause.

## Analyze and generalize before closing

After every finding series, group findings by shared mechanism:

- limited AST-depth traversal;
- a missing container or transparent wrapper;
- incomplete alias collection;
- incomplete property, index, type, or list resolution;
- an incorrect scope boundary;
- incorrect rule-priority ordering;
- a language-specific or equivalent syntax branch.

For every group, build at least one fixture for the original case and one for a
nearby realistic variant. Verify that the shared fix closes the group without
creating false positives. If several findings share one mechanism, document
the generalized pattern and include representative bypass code in Markdown,
not only a list of file names.

Nested classes and nested types forbidden by dedicated priority rules must be
rejected before class metrics and type checks. Do not record a metric finding
for a construct that should already be rejected by a higher-priority structural
rule.

## Ongoing audit conditions

Every report includes attempt numbers, finding counts, generalized patterns,
and verification results. A positive attempt-6 report is the handoff package;
a zero-finding attempt-6 report continues with attempt 7. The findings file is
never cleared.
