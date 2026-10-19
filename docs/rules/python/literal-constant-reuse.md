# literal-constant-reuse

Description: Use an existing named constant when production code repeats its non-trivial
string value. The diagnostic is reported at each literal occurrence, including
when the value is used only once in the consuming callable.

Bad:


Good:


The rule applies to TypeScript and Python production code and ignores test
files and short strings.

## Bad


```python
CONNECTION_MESSAGE = "connection is unavailable"

def report_connection_state() -> None:
    print("connection is unavailable")
```

## Good


```python
# File: src/constants.py
ERROR_MESSAGE: str = "read failed"
# File: cli.py
from src.constants import ERROR_MESSAGE
if __name__ == "__main__": raise RuntimeError(ERROR_MESSAGE)
```
