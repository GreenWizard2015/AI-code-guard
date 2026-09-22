# `typescript-static-method`

**Purpose:** Keep dependencies explicit instead of hiding them in class-level behavior.

```ts
class User {
  private readonly id: string;

  public constructor(id: string) {
    this.id = id;
  }

  public static create(id: string) {
    const normalized_id = id.trim();
    if (normalized_id.length === 0) {
      throw new Error('id is required');
    }
    return new User(normalized_id);
  }
}
```

**Fix:** Use `function create_user(id: string): User` or inject a factory.
