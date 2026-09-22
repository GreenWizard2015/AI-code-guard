# Type guards

**Purpose:** Keep project state transitions explicit instead of hiding them in a
TypeScript return predicate.

**Diagnostic:** `typescript-type-guard`

**Example:**

```ts
function is_user(value: unknown): value is User {
  return value instanceof User;
}
```

**Fix:** Return an explicit result or use a dedicated class/protocol boundary.
Do not use return types of the form `value is Type` for project behavior.

For primitive external input, use one `typeof` check at the boundary, return the
explicit domain type, and avoid repeating runtime checks in business logic.
