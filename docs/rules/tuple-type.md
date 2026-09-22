# `tuple-type`

**Purpose:** Detect TypeScript tuple type contracts, including readonly and labelled tuples.

Tuples expose data through positional indexes. This makes a result harder to understand and
allows callers to depend on ordering instead of a named contract.

Prefer a named interface or a class with explicit fields:

```ts
type ResolvedTypeScriptExport = readonly [file: string, name: string];

interface ResolvedExport {
  file(): string;
  name(): string;
}
```

The rule reports type syntax such as `readonly [file: string, name: string]` and `[string, number]`.
