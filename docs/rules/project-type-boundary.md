# `project-type-boundary`

**Purpose:** Public callable parameters and results must expose a Protocol, interface, or focused
value contract instead of a project implementation class.

```ts
class UserStore {
  load(): User {  // violation
    return new User();
  }
}

function save(user: User): void {  // violation
  // ...
}
```

The rule resolves project type aliases and generic containers. Protocols, interfaces, and named
type contracts remain valid boundary types.

**Fix:** Depend on a narrow Protocol or interface and keep concrete classes behind that boundary.
