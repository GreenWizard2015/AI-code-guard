# `nullable-domain-type`

Description: Do not use `null`, `undefined`, `None`, `Optional`, `Any`, `unknown`, `void`,
or `never` at a field, parameter, or return boundary. Model meaningful absence
with an explicit domain contract instead of a nullable value.

## Bad


```python
# File: cli.py
from typing import Optional

def display_label(label: Optional[str]) -> Optional[str]:
    if label is None:
        return None
    return label.strip()

if __name__ == "__main__":
    print(display_label(None))
```

If absence is a real state, define an interface or protocol for the shared
behavior and distinct classes for each state. Keep the serialized boundary
representation local to the adapter that communicates with an external system.

## Good


```python
# File: cli.py
def display_label(label: str) -> str:
    """Responsibilities: _label display_."""
    return label.strip()

if __name__ == "__main__":
    print(display_label("ready"))
```
