# `rest-union-contract`

Description: See the examples below for the rule behavior.

### Policy

Do not use any union anywhere in the type of a TypeScript rest parameter.

### Fix

Use one explicit options object or separate named operations:

```ts
type CollectOptions = {
    context?: LintProjectContext;
    entry_files?: readonly string[];
};

function collect(root: string, options: CollectOptions = {}): Violation[] {
    // The contract is explicit.
}
```

## Bad

```ts
function collect(
    ...provided: readonly (LintProjectContext | readonly string[] | undefined)[]
): Violation[] {
    // The argument meaning is selected by runtime shape.
}

function collect_arrays(...provided: (LintProjectContext[] | string[])[]): void {}
```

## Good

```ts
// File: src/types.ts
export type CollectOptions = { root: string };
// File: cli.ts
import { CollectOptions } from "src/types";
(function (options: CollectOptions) { console.log(options.root); })({ root: "src" });
```
