# `parse-error`

Description: Fix syntax errors before relying on structural lint diagnostics.

## Bad


```python
def read_value( -> str:
    return "ready"
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
