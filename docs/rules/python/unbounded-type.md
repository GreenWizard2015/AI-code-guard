# `unbounded-type`

Description: Do not use `any` or `unknown` in TypeScript, or `Any` in Python. The rule applies to
all type annotations recognized by the AST, including parameters, fields, return values, and
generic type positions.

**Bad:**


```python
def read_value(value: Any) -> Any:
    return value
```


Fix: Replace the unbounded type with a concrete domain type or focused protocol.

## Bad


```python
def read(value: Any) -> str:
    return value
```

## Good


```python
if __name__ == "__main__":
    value: str = "ready"
    print(value)
```
