# `mutable-field-assignment`

**Purpose:** Mutation outside construction makes object state hard to reason about.

```py
def refresh(self):
    self.result = fetch()
```

**Fix:** Return a new state value or use one explicit state-transition method.
