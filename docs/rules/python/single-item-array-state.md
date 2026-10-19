# `single-item-array-state`

Description: Do not replace a nullable domain result with an array whose first element is treated as the value, including a temporary `[0]` value followed by an `undefined` guard.

**Bad:**


### Replacement

**Fix:** Return an explicit state contract, such as `FoundService | MissingService`, and let each state own its behavior.


The rule reports any element access on a locally declared function, method, or arrow function whose declared result is an array. It also reports a local value assigned from `[0]` and immediately guarded against `undefined`. In Python, the equivalent is a locally declared function or method returning `list[T]` or `List[T]` and then accessed by index. Real collection processing should use a named collection contract and explicit collection operations rather than using an indexed access as a missing-value state.

```python
def find_service() -> list[Service]:
    return []

service = find_service()[0]
```

## Bad


```python
# File: cli.py
def find_items() -> list[str]: return ["item"]
item = find_items()[0]
print(item)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
