# `sys-path-mutation`

Description: Configure import paths through the project environment or test runner instead of mutating `sys.path`.

## Bad

```python
# File: cli.py
import sys

if __name__ == "__main__":
    sys.path.insert(0, "src")
    print("ready")
```

Configure import roots through the project environment or test runner rather than mutating `sys.path`.

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
