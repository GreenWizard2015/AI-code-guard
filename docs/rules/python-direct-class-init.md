# `python-direct-class-init`

**Purpose:** Direct `Class.__init__` calls bypass normal construction and inheritance invariants.

```py
Base.__init__(self, value)
```

**Fix:** Use `super().__init__(value)` inside a subclass or construct the object normally.
