# `class-like-prefix`

**Purpose:** Many top-level functions with one class-style prefix often indicate a missing owner.

```ts
function User_load(): void {}
function User_save(): void {}
```

**Fix:** Group cohesive behavior in a focused class or module.

```py
def User_load() -> None:
    pass


def User_save() -> None:
    pass
```
