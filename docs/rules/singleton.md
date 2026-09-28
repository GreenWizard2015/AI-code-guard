# `singleton`

**Purpose:** A module-level class instance or Python `ClassVar` creates hidden shared state.

```ts
export const CLIENT = new Client();
```

**Fix:** Construct dependencies at the composition root and inject them into consumers.

```py
class Registry:
    entries: ClassVar[dict[str, str]] = {}
```

Move class-level mutable state to an explicitly owned instance. Use a module-level immutable
constant only for genuinely shared configuration.
