# `naming`

**Purpose:** Consistent names improve searchability across Python and TypeScript.

```ts
const store_failed_task_result = value => value;
```

**Fix:** Use `snake_case`, at most three words, for functions, methods, variables, and fields. Use `PascalCase` without underscores for classes, interfaces, enums, and named type aliases.

The same method rule applies to methods declared in project interfaces. External runtime API names remain boundary exceptions.
