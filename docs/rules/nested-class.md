# `nested-class`

**Purpose:** Nested classes hide ownership and make dependencies harder to discover.

```ts
class Service {
  public static readonly state = class State {};
}
```

**Fix:** Move the class to a focused top-level module or use composition. Dataclasses and
exception classes remain valid small-file owners.
