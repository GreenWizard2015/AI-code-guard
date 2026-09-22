# `typescript-type-operation`

**Purpose:** Type operations can hide a project contract behind a transformed type.

```ts
type VisibleFields = Pick<User, 'id' | 'name'>;
```

**Fix:** Declare a named project type with the fields and operations it owns. Keep standard library
and external API transformations when they are the actual boundary contract.
