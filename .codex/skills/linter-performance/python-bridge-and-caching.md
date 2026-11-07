# Python bridge and reusable state

Read this reference when changing Python analysis, bridge lifecycle, fixture startup, or cross-run caches.

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
