# `typescript-jest-max-count`

**Purpose:** Detect Jest suites exceeding the configured maximum test count.

**Fix:** Split the suite by cohesive behavior. Do not keep unrelated tests in one `describe` block.
