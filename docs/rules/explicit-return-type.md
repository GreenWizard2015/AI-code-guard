# `explicit-return-type`

Require every named callable to declare its result type explicitly in both
TypeScript and Python. The rule covers functions, methods, getters, and
interface methods. Constructors, setters, and anonymous callback functions are
excluded because they do not define an independent result boundary.

```ts
// Bad
function load_user(user_id: string) {
  return repository.find(user_id);
}

// Good
function load_user(user_id: string): User {
  return repository.find(user_id);
}
```

```py
# Bad
def load_user(user_id: str):
    return repository.find(user_id)

# Good
def load_user(user_id: str) -> User:
    return repository.find(user_id)
```

`__init__` must use `-> None`. Do not rely on inference at a callable boundary;
use `None`, `Result`, or another explicit domain result contract.
