# `unused-module-variable`

Description: Reports a module-level variable with no production symbol usage. Move owned state
behind an explicit owner or remove the unused variable.

## Bad


```python
# File: source.py
request_count = 0  # <- error
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    request_count = 0
    print(request_count)
```
