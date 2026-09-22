# `python-property`

**Purpose:** Keep behavior explicit. Python `@property` hides a method call behind attribute access.

```py
class Service:
    loader: Loader

    def __init__(self, loader: Loader):
        self.loader = loader

    @property
    def status(self):
        return self.load_status()
```

**Fix:** Replace the property with an explicitly named method, such as `status()`.

`@cached_property` is not covered by this rule.
