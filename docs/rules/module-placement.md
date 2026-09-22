# `module-placement`

Reports a production module that is nested below the common directory of its
importers. The diagnostic includes concrete destination candidates.

A deeper path is valid when its first focused folder is distinct from every
caller folder. The diagnostic also reminds the caller not to place the module
in a directory ignored by Git.

Prefer moving a module and its exported types/functions together. If the
module is shared, place it at the common boundary; otherwise keep it in one
focused folder that is not a caller folder and is not ignored by Git.

Reports a production module whose directory is deeper than the directory shared by its production importers.

This applies to modules containing classes, types, functions, or mixed exports. The dependency should live at the first common ownership level, or in one deliberately focused subdirectory.

**Example:** `a/b/c/parser.ts` imported by `a/c/service.ts` and `a/view.ts` is a candidate for `a/parser.ts` or `a/parser/parser.ts`.

**Fix:** inspect all importers, move the module and its related exports to the ownership boundary, then update imports. Do not move a file only to silence the diagnostic or create a generic shared folder.

The diagnostic prints concrete destination candidates. When the importer boundary is the repository root, it suggests either the file in the repository root or a focused subdirectory directly under the root; it never suggests moving above the root.
