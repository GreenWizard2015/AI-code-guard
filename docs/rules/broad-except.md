# `broad-except`

**Purpose:** Broad catches hide unrelated programming failures.

```py
try:
    run()
except Exception:
    recover()
```

**Fix:** Catch only the expected exception at the I/O, network, process, or JSON boundary.

