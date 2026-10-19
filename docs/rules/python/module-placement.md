# `module-placement`

Description: Reports a production module that is nested below the common directory of its
importers. The diagnostic includes concrete destination candidates.

A deeper path is valid when its first focused folder is distinct from every
caller folder. The diagnostic also reminds the caller not to place the module
in a directory ignored by Git.

A grouped ownership path may be up to two directories below the common importer
boundary when its immediate directory contains at least three source files.
This permits populated domain groups while still reporting isolated deep files.

Prefer moving a module and its exported types/functions together. If the
module is shared, place it at the common boundary; otherwise keep it in one
focused folder that is not a caller folder and is not ignored by Git.

Reports a production module whose directory is deeper than the directory shared by its production importers.

This applies to modules containing classes, types, functions, or mixed exports. The dependency should live at the first common ownership level, or in one deliberately focused subdirectory.

**Example:** `a/b/c/parser.ts` imported by `a/c/service.ts` and `a/view.ts` is a candidate for `a/parser.ts` or `a/parser/parser.ts`.


Fix: inspect all importers, move the module and its related exports to the ownership boundary, then update imports. Do not move a file only to silence the diagnostic or create a generic shared folder.

The diagnostic lists every top-level class, interface, protocol, type, constant,
variable, and function found in the misplaced module, followed by its focused
destination. Constants use the exact sibling `constants.ts` or `constants.py`,
types and interfaces use `types.ts` or `types.py`, protocols use
`protocols.ts` or `protocols.py`, and free functions use the project-root
`functions.ts` or `functions.py` file. This makes the move precise even when
the file contains constants or contracts rather than a class.
When the importer boundary is the repository root, it suggests either the file
in the repository root or a focused subdirectory directly under the root; it
never suggests moving above the root. A populated grouped ownership directory
is also valid within the documented depth limit.

## Bad


```python
# File: src/a/b/c/constants.py
MAX_ATTEMPTS = 3  # <- error
# File: src/a/cli.py
from src.a.b.c.constants import MAX_ATTEMPTS
if __name__ == "__main__": print(MAX_ATTEMPTS)
# File: src/a/b/cli.py
from src.a.b.c.constants import MAX_ATTEMPTS
if __name__ == "__main__": print(MAX_ATTEMPTS)
```

## Good


```python
# File: src/a/constants.py
MAX_ATTEMPTS = 3
# File: src/a/cli.py
from src.a.constants import MAX_ATTEMPTS
if __name__ == "__main__": print(MAX_ATTEMPTS)
# File: src/a/b/cli.py
from src.a.constants import MAX_ATTEMPTS
if __name__ == "__main__": print(MAX_ATTEMPTS)
```
