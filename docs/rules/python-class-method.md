# `python-class-method`

**Purpose:** Class-level factories hide construction policy.

```py
class Token:
    token: str

    def __init__(self, token: str):
        self.token = token

    @classmethod
    def from_text(cls, text: str) -> "Token": ...
```

**Fix:** Use a named module factory or an injected factory object.
