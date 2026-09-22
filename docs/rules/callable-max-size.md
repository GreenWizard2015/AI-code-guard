# `callable-max-size`

**Purpose:** Detect functions and methods whose implementation is too large to remain one focused
operation.

**Fix:** Extract a cohesive operation or move behavior to its owning collaborator. Check callers and
preserve state ownership; do not create arbitrary forwarding helpers.

The metric combines callable body lines and executable SLOC. The callable signature and Python
docstrings are excluded from the measurement.

The shared significant-character metric ignores spaces, tabs, and line breaks. The 100-character limit is a separate diagnostic from the line and SLOC limits; a callable can satisfy
the line metric and still require decomposition when its implementation is too dense.
