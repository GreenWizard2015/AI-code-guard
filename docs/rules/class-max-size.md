# `class-max-size`

**Purpose:** Detect classes too large to keep as one cohesive responsibility.

**Fix:** Extract cohesive collaborators and move behavior to the class that owns it. Audit callers
before changing the boundary; do not hide size behind wrappers or arbitrary delegation.

The metric combines class body lines and executable SLOC. The class declaration signature and Python
docstrings are excluded from the measurement.
