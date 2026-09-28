# `functions-file-max-count`

`functions.ts` and `functions.py` are only entry modules for a small set of
cohesive functions. They may contain at most five functions.

When the limit is exceeded, classify each function by the responsibility it
owns. Move related functions and their private helpers into the owning class,
reference component, or focused domain module. Do not move unrelated
functions into another catch-all file, and do not add wrappers only to hide the
count.
