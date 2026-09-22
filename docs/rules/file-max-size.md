# `file-max-size`

**Purpose:** Detect source files that exceed 500 raw source lines, including comments, blank lines,
docstrings, and test files.

**Fix:** Split the file by ownership into focused modules. Do not hide file size behind wrappers or
generated-looking padding.
