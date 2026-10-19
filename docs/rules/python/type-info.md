# `type-info`

Description: Prefer a concrete value contract or focused protocol over unbounded boundary types.

This applies to both languages. In TypeScript it includes `any`, `unknown`, and
`object`; in Python it includes `Any`, `typing.Any`, `typing_extensions.Any`,
`object`, and equivalent unbounded aliases. Use a concrete value type or a
focused protocol instead.

## Bad


```python
# File: cli.py
def parse(value) -> object:
    return value

if __name__ == "__main__":
    parsed = parse("ready")
```

## Good


```python
# File: cli.py
def parse(value: str) -> str:
    return value

if __name__ == "__main__":
    parsed = parse("ready")
```
