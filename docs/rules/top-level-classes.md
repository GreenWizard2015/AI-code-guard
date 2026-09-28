# `top-level-classes`

**Purpose:** One primary top-level class gives a file a clear owner.

```ts
export class A {
  private readonly name = 'a';
}
export class B {
  private readonly name = 'b';
}
```

**Fix:** Move independent classes to focused files; keep one small exception hierarchy together when appropriate.

```py
class A:
    name: str = 'a'


class B:
    name: str = 'b'
```
