# repeated-literal

Description: Production code should not repeat the same non-trivial string literal two or
more times.

Bad:


Name the shared value or domain error once. If a matching project constant already
exists, every literal occurrence is reported as a use-the-constant violation,
even when it occurs only once. Otherwise, two or more production occurrences
are reported as a request to introduce a constant. The rule ignores strings
shorter than eight characters, standalone documentation strings, and test
files. Strings used as arguments or nested object, array, and collection values
are included at every depth.

## Bad


```python
raise RuntimeError("read failed")
log("read failed")
```

## Good


```python
# File: src/constants.py
ERROR_MESSAGE: str = "read failed"
# File: cli.py
from src.constants import ERROR_MESSAGE
if __name__ == "__main__": raise RuntimeError(ERROR_MESSAGE)
```
