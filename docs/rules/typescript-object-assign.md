# `typescript-object-assign`

**Purpose:** Bulk mutation hides which owned fields change.

```ts
Object.assign(this.state, update);
```

**Fix:** Assign owned fields explicitly or return a new state value.
