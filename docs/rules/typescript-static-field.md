# `typescript-static-field`

**Purpose:** Keep class state owned by an explicit instance or by the module, instead of hiding shared state on a class.

```ts
class SessionStore {
  private static readonly sessions = new Map<string, Session>();
}
```

**Fix:** Move instance state to an explicitly owned object, or move an immutable constant to the module level.

```ts
class SessionStore {
  private readonly sessions = new Map<string, Session>();
}
```

Static methods are checked by `typescript-static-method`; this rule reports only static property declarations.
