# `typescript-explicit-visibility`

**Purpose:** Implicit TypeScript visibility hides the public API.

```ts
class Client {
  private readonly endpoint = '/messages';

  public send(): void {
    this.endpoint;
  }
}
```

**Fix:** Declare `public`, `protected`, or `private` on every class field and method.
