# `sys-path-mutation`

Description: Configure import paths through the project environment or test runner instead of mutating `sys.path`.

## Bad

```python
# File: import_configuration.py
import sys

class ImportConfiguration:
    def __init__(self) -> None:
        self.search_paths = sys.path

    def add_import_root(self, path: str) -> None:
        self.search_paths.append(path)
        configured_paths = self.search_paths
        configured_paths.append(path)
```

The instance field and its local alias still mutate the process-wide import path.

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```

Configure import roots through the project environment or test runner instead.
