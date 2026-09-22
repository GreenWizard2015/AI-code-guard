# `class-method-max-count`

**Purpose:** Detect classes with more than fifteen public or non-public methods.

**Fix:** Refactor toward focused classes with cohesive APIs. Do not keep a class as a namespace for
unrelated helpers or add private methods only to satisfy the count.
