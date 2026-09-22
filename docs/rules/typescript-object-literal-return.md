# `typescript-object-literal-return`

**Purpose:** A class or behavioral interface return contract must be implemented
by a real class, not by an object literal with callable fields.

**Preferred fix order:**

1. Move invariants and owned data into an immutable value class.
2. Put wire-format conversion behind a dedicated serializer or payload class.
3. Return the class from the behavioral contract and serialize only at the
   boundary.
4. Keep a plain object when the returned contract is data-only and the object
   has no callable fields.

**Avoid:** empty wrappers, forwarding-only classes, and aliases introduced
only to silence the diagnostic.

Data-only object literals are allowed even when their return annotation names a
structural interface or class. The rule is about callable fields: a serializer
or factory may construct a wire payload directly, while an object literal that
implements behavior must be replaced with a real class.

```ts
interface UserView {
  name(): string;
}

class NamedUser implements UserView {
  private readonly user_name: string;

  public constructor(user_name: string) {
    this.user_name = user_name;
  }

  public name(): string {
    return this.user_name;
  }
}

function create_user(): UserView {
  return new NamedUser('Ada');
}
```
