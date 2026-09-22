# `python-explicit-parameter-type`

Require an explicit type for every Python input parameter. This includes
positional-only, keyword-only, `*args`, `**kwargs`, and callback parameters.
`self` and `cls` are the only implicit receiver exceptions because annotating
them requires a forward reference to the containing class.

```py
# Bad
def render(template, *, pretty=False):
    ...

# Good
def render(template: Template, *, pretty: bool = False) -> str:
    ...

def merge(*parts: str, **options: str) -> str:
    ...
```

Use a meaningful type instead of `Any` unless the boundary genuinely accepts
unknown values. Isolate dynamically typed external data in an adapter.
