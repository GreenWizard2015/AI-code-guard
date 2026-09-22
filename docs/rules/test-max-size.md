# `test-max-size`

Tests have a dedicated size diagnostic because the correct fix is to split their
behavior into smaller tests, not to extract arbitrary wrappers.

**Fix:** split the test into focused tests that each verify one behavior. Do not
hide statements in callbacks or compressed expressions to bypass the limit.
