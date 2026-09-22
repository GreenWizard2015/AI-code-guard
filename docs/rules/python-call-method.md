# `python-call-method`

**Purpose:** `__call__` makes an operation unclear at call sites.

```py
class Runner:
    result: Result

    def __init__(self, result: Result):
        self.result = result

    def __call__(self) -> Result: ...
```

**Fix:** Expose a descriptive method such as `run()` or `resolve()`.
