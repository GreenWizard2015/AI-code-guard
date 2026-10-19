# `pointless-assignment`

Description: A temporary assigned and immediately returned value adds indirection.


## Bad


```python
# File: src/value_builder/value_builder.py
class ValueBuilder:
    def build(self) -> str:
        result = "ready"
        return result
```

**Fix:** Return `build(input)` directly unless the name is reused or documents a real transition.

The target diagnostic is demonstrated by the `result` assignment immediately returned above.

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value = "ready"
    print(value)
```
