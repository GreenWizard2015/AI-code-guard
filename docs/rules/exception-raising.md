# `exception-raising`

**Purpose:** Keep test control flow explicit without exceptions.

The rule reports TypeScript `throw` statements and Python `raise` statements in test files only.

**Fix:** Return an explicit result or handle failure without an exception.
Do not use `raise` or `throw` in tests.
