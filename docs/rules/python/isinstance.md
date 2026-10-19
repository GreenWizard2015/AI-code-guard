# `isinstance`

Description: Validate values at a boundary and avoid repeated `isinstance` checks in business logic.

## Bad

```python
# File: src/value_reader/value_reader.py
class ValueReader:
    def read(self, value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, int):
            return str(value)
        return "unsupported"
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("validated at the input boundary")
```
