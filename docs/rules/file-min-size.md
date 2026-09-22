# `file-min-size`

**Purpose:** Detect files too small to justify a separate module boundary.

**Fix:** Merge the file into the focused neighboring module or move meaningful ownership into it. Do
not keep a thin wrapper only to preserve a file split.
