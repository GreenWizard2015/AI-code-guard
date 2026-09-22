# `class-method-min-count`

**Purpose:** Detect classes with fewer than two public or non-public methods where a class boundary
does not provide enough behavior.

**Fix:** Add meaningful behavior or move the class to a boundary where one method is sufficient. Do
not add placeholder methods only to satisfy the count.
