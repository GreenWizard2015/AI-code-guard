# `module-constants-separation`

Description: Module-level constants must be separated from implementation code in every ordinary file.
Move them to the exact sibling `constants.ts` or `constants.py`, or to one focused file when
the constants belong together.

Do not keep module-level constants beside implementation code.

## Bad


```python
DEFAULT_LIMIT = 10
class Service: pass
```

## Good


```python
# File: src/constants.py
DEFAULT_LIMIT: int = 10
# File: cli.py
from src.constants import DEFAULT_LIMIT

if __name__ == "__main__":
    print(DEFAULT_LIMIT)
```
