# `typescript-jest-min-count`

**Purpose:** Detect Jest suites containing fewer than two tests.

**Fix:** Add a second focused test or remove the unnecessary suite wrapper. Do not create a
`describe` block for one tiny test.
