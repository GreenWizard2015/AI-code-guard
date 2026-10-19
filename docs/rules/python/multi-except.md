# `multi-except`

Description: One handler for unrelated failures obscures recovery behavior.

```python
try:
    read_data()
except (TimeoutError, ValueError):
    recover()
```


Fix: Use one exception type per handler and keep a general boundary handler minimal.

## Bad

```python
try:
    read()
except (TimeoutError, ValueError):
    pass
```

## Good

```python
try:
    read()
except ValueError as error:
    raise RuntimeError("read failed") from error
```
