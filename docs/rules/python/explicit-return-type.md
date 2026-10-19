# `explicit-return-type`

Description: Require every named callable to declare its result type explicitly in both
TypeScript and Python. The rule covers functions, methods, getters, and
interface methods. Constructors, setters, and anonymous callback functions are
excluded because they do not define an independent result boundary.


```python
# Bad
def load_user(user_id: str):
    return repository.find(user_id)

# Good
def load_user(user_id: str) -> User:
    return repository.find(user_id)
```

`__init__` must use `-> None`. Do not rely on inference at a callable boundary;
use `None`, `Result`, or another explicit domain result contract.

## Bad


```python
def read_value(value: str):
    return value
```

## Good


```python
# File: cli.py
def read_value(value: str) -> str:
    """Responsibilities: _value reading_."""
    return value

if __name__ == "__main__":
    print(read_value("ready"))
```
