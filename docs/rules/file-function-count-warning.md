# `file-function-count-warning`

Split files with too many functions by ownership and keep each resulting module focused. The
project-root `functions.ts` and `functions.py` files may contain at most five functions; other
production files use the general limit.
