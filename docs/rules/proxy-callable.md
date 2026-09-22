# `proxy-callable`

**Purpose:** A function that only forwards its arguments, forwards a zero-argument call, or exposes one property, adds no behavior.

```ts
function update(id: string, title: string) { return flow.update(id, title); }

class Contact {
  private readonly required_reason_value: string;

  public constructor(required_reason: string) {
    this.required_reason_value = required_reason;
  }

  public close_contact_reason() {
    return this.required_reason_value;
  }
}
```

**Fix:** Call `flow.update()` at the caller or move real behavior to the owning class.
