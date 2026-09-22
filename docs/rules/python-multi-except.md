# `python-multi-except`

**Purpose:** One handler for unrelated failures obscures recovery behavior.

```py
try:
    read_data()
except (TimeoutError, ValueError):
    recover()
```

**Fix:** Use one exception type per handler and keep a general boundary handler minimal.
