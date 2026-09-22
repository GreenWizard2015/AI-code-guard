# `callable-min-size`

**Purpose:** Detect functions and methods whose implementation is too small to own meaningful
behavior.

**Fix:** Inline a short forwarding operation, move behavior to its caller, or replace the indirection
with a focused module function. Do not add padding or wrappers only to satisfy the rule.

The metric combines callable body lines and executable SLOC. The callable signature is excluded from
the line measurement, and Python docstrings are excluded from both measurements.

The 100-character limit ignores whitespace and is evaluated separately from the minimum line and SLOC size. Do not add padding
or artificial statements to satisfy either metric.

For a genuine minimum-size finding, either add real behavior that belongs to the callable or lower
the character threshold when the callable is intentionally small. Do not inflate the implementation
just to cross a limit.
