{{REVIEW_PREAMBLE}}

Map critical production behavior to tests and inspect whether assertions prove
observable results rather than implementation details, call counts, or object
shape alone. Look for missing failure-path coverage, tests that duplicate a
stronger integration invariant, obsolete tests that encode removed behavior,
and fixtures that hide the real boundary under test.

Do not report a missing test for trivial code or a preferred test framework.
Report a testing defect only when an important behavior can regress without a
test that would fail for the real defect.

A test is defective when its assertions only confirm behavior programmed into
a mock, stub, or fake rather than observing the production behavior under test.
Mocks may isolate external boundaries, but the test must still exercise the
real production code and assert its observable result. Confirm the gap by
static inspection of the production path, test setup, and assertions. Do not
run tests, lint, builds, mutation tools, or other project commands. Do not edit
production code or tests during this stage.

For every suspected defect, identify the production behavior, the existing
test that appears to cover it, and a concrete hypothetical production change
that the existing assertions would miss. Reason about that change from the
source; never present it as executed or verified. Separate missing coverage
from a weak assertion and from obsolete test setup. Prefer a focused regression
test at the lowest boundary that observes the real result.

Compare tests of every type and layer by scenario and observable result. If a
test checks scenario A through class X and another test at a higher boundary
already exercises the same production behavior and proves the same result,
report the lower-level test as redundant and recommend removing it. Keep it when
it verifies a distinct contract or failure mode that the higher-level test does
not prove. Apply this comparison to unit, integration, end-to-end, contract,
acceptance, and other test categories; category names do not exempt duplicate
coverage.

Prefer tests that exercise real production collaborators without mocks across
all test categories. Use mocks only to isolate necessary external or
nondeterministic boundaries; when a real-collaborator test already proves the
same behavior, report the mock-based duplicate. Do not mix tests with mocks and
tests without mocks in one suite, regardless of whether they are unit,
integration, end-to-end, contract, acceptance, or another type. Group suites by
their actual test boundary and strategy, and report mixed suites with the tests
and boundary that should be regrouped.

## Checklist

- [ ] Map each important production behavior and failure path to the test that should fail if it regresses.
- [ ] Check that assertions prove observable results rather than calls, implementation shape, or mere presence.
- [ ] Check success, failure, retry, cleanup, boundary, and empty-input cases where they affect behavior.
- [ ] Identify tests that duplicate a stronger test and tests that encode behavior no longer present in production.
- [ ] Compare scenario coverage across all test types and layers; report redundant lower-level tests when another test proves the same behavior and result.
- [ ] Check whether fixtures, mocks, and helpers hide the real ownership or integration boundary.
- [ ] Detect tests that assert only a mock's configured response or interactions without verifying the real production behavior and its result.
- [ ] Prefer no-mock tests where real collaborators can exercise the production behavior; report redundant mock-based coverage in any test category.
- [ ] Check that every suite consistently uses mocks or real collaborators, independent of its test category; report any mixed suite and recommend grouping by actual boundary and strategy.
- [ ] Statically trace a minimal hypothetical defect and determine whether the current assertions would detect it.
- [ ] Check isolation, determinism, and whether the test can pass without exercising the claimed behavior.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

