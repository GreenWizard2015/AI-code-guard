# `nested-type`

**Purpose:** Type declarations must be top-level so their ownership and reuse remain visible.
The rule covers TypeScript type aliases, interfaces, and enums, plus Python `TypeAlias`,
`TypeAliasType`, and structural type declarations nested inside classes, functions, or other
scopes. Nested classes are reported separately by `nested-class`.

**Bad TypeScript:**

```ts
function create() {
  type LocalState = { ready: boolean };
  return {};
}
```

**Bad Python:**

```py
def create():
    LocalState: TypeAlias = str
    return "value"
```

**Fix:** Move each type declaration to a focused top-level module and import it where needed.
