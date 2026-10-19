# incomplete-cache-key

Description: Reports a callable that reads from one cache receiver with `get(key)` and then
writes to the same receiver with `set(other_key, value)`. The rule intentionally
does not infer missing semantic inputs; it reports only a provable mismatch in
the lookup and write expressions.

TypeScript:


Python:

```python
def load(file: str, text: str) -> Result:
    cached = cache.get(file)
    cache.set(file + text, create_result())
    return cached
```

Use one named key expression or key-building operation for both operations.

## Bad


```python
def load(cache: object, key: str) -> str:
    cached = cache.get(key)
    cache.set(key + ":refresh", cached)
    return cached
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
