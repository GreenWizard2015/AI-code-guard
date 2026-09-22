# `conditional-execution`

**Purpose:** Side effects hidden in `&&`, `||`, or `??` are hard to audit.

```ts
ready && client.send(message);
```

**Fix:** Use an explicit `if`; boolean-only logical expressions are allowed.

