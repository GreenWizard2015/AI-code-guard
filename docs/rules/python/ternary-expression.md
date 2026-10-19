# `ternary-expression`

Description: Dense conditional expressions hide state transitions.


## Bad


```python
# File: cli.py
if __name__ == "__main__":
    ready = True
    result = read_cache() if ready else fetch_remote()
    print(result)
```

**Fix:** Use explicit `if/else`; primitive-only ternaries are allowed by the rule.

```python
result = loaded if ready else fallback
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    result = "fallback"
    ready = True
    if ready:
        result = "loaded"
    print(result)
```
