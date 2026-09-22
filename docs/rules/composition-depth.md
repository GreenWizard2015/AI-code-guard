# `composition-depth`

**Purpose:** Deep wrapper chains couple behavior to too many ownership layers.

```text
A -> B -> C -> D
```

**Fix:** Remove pass-through layers and keep only classes with their own state or lifecycle.
