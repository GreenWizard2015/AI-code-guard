# `constants-file-content`

Description: Files named `constants.ts` or `constants.py` contain constant values only. Keep
classes, functions, and types in their focused implementation or contract files.

## Bad


```python
# File: src/constants.py
class Service:
    def run(self) -> str:
        return "ready"
```

## Good


```python
# File: src/constants.py
DEFAULT_LIMIT = 10
# File: cli.py
from src.constants import DEFAULT_LIMIT

if __name__ == "__main__":
    print(DEFAULT_LIMIT)
```
