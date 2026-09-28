# `ternary-expression`

**Purpose:** Dense conditional expressions hide state transitions.

```ts
const RESULT = ready ? load() : null;
```

**Fix:** Use explicit `if/else`; primitive-only ternaries are allowed by the rule.

```py
result = loaded if ready else fallback
```
