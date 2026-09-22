# `function-placement`

Module-level functions belong only in the exact project-root file named `functions.ts`,
`functions.tsx`, or `functions.py`.

When it is present, the report shows only function-placement diagnostics until the functions are
moved.

FIRST move all functions to `{project root}/functions.{ext}`, then fix other problems. Class methods
are not module-level functions and remain in the class that owns their state and behavior.
