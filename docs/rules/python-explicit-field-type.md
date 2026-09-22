# `python-explicit-field-type`

Require explicit annotations for every Python class field, including class,
instance, dataclass, and `ClassVar` fields. Assignment alone is not a type
declaration. Local variables are not fields merely because they are annotated.

```py
# Bad
class Session:
    def __init__(self, token: str) -> None:
        self.token = token
        self.retries = 0

# Good
class Session:
    token: str
    retries: int

    def __init__(self, token: str) -> None:
        self.token = token
        self.retries = 0
```

For a field created only in a constructor, an annotated assignment such as
`self.token: str = token` is also acceptable.
