# `complex-constructor`

**Purpose:** I/O and business logic during construction create partial objects.

```py
def __init__(self, url: str):
    self.document = fetch_and_parse(url)
```

**Fix:** Validate and assign dependencies in the constructor; move work to `load()` or a factory.
