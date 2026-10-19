{{REVIEW_PREAMBLE}}

Identify the dominant work in real execution paths and follow its inputs to
the first avoidable repetition. Check repeated parsing, traversal of parsed
representations, graph
resolution, serialization, scans, cache invalidation, and data structures.
Estimate the affected complexity or frequency from code evidence and propose a
cache, index, traversal boundary, or data-ownership change only when it keeps
diagnostic behavior equivalent.

## Checklist

- [ ] Follow the real call path to the repeated parse, traversal, lookup, serialization, or scan.
- [ ] Identify the input size, repetition count, and execution scope that make the work material.
- [ ] Check whether the same representation is parsed or traversed more than once in one run.
- [ ] Check whether an index, cache, batching boundary, or ownership change removes the repetition safely.
- [ ] Verify that cache keys include all inputs and that invalidation cannot return stale results.
- [ ] Check ordering, diagnostics, error behavior, and language coverage before proposing an optimization.
- [ ] Distinguish a measured or code-demonstrated cost from a theoretical micro-optimization.

Do not report a theoretical micro-optimization or a slower path that is not
reachable at project scale. Report only a concrete algorithmic defect with a
credible cost and a measurable correction.

For every suspected defect, name the repeated operation, its input size or
frequency, and the point where the repetition can be removed. Check that a
proposed index or cache has a complete invalidation key and preserves ordering,
diagnostics, and error behavior. Do not report a performance concern without
following the actual call path to the repeated work.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

