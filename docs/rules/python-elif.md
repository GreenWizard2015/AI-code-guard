# `python-elif`

**Purpose:** Explicit nested branches make each scope visible.

```py
if first:
    use_first()
elif second:
    use_second()
```

**Fix:** Put `if second:` inside an explicit `else` block.

