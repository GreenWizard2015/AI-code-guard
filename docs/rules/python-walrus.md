# `python-walrus`

**Purpose:** Assignment expressions hide mutation inside a condition.

```py
if match := find(value):
    use(match)
```

**Fix:** Assign first, then test the value in a separate statement.

