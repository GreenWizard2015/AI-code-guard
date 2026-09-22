# `typescript-rest-union-contract`

## Policy

Do not use any union anywhere in the type of a TypeScript rest parameter.

## Bad

```ts
function collect(
    ...provided: readonly (LintProjectContext | readonly string[] | undefined)[]
): Violation[] {
    // The argument meaning is selected by runtime shape.
}

function collect_arrays(...provided: (LintProjectContext[] | string[])[]): void {}
```

## Fix

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
