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
changing or bypassing the production behavior while leaving the mock setup
unchanged; if the test still passes, report the concrete missing coverage.

For every suspected defect, identify the production behavior, the existing
test that appears to cover it, and the exact mutation that would currently
pass. Separate missing coverage from a weak assertion and from obsolete test
setup. Prefer a focused regression test at the lowest boundary that observes
the real result.

## Checklist

- [ ] Map each important production behavior and failure path to the test that should fail if it regresses.
- [ ] Check that assertions prove observable results rather than calls, implementation shape, or mere presence.
- [ ] Check success, failure, retry, cleanup, boundary, and empty-input cases where they affect behavior.
- [ ] Identify tests that duplicate a stronger test and tests that encode behavior no longer present in production.
- [ ] Check whether fixtures, mocks, and helpers hide the real ownership or integration boundary.
- [ ] Detect tests that assert only a mock's configured response or interactions without verifying the real production behavior and its result.
- [ ] Apply the smallest mutation that represents the suspected defect and verify the current tests fail to detect it.
- [ ] Check isolation, determinism, and whether the test can pass without exercising the claimed behavior.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

