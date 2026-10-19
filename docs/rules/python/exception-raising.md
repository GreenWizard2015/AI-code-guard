# `exception-raising`

Description: Keep test control flow explicit without exceptions.

The rule reports TypeScript `throw` and Python `raise` only in files identified as tests by their filename. A support module under `tests/` is not a test file by location alone.


Fix: Return an explicit result or handle failure without an exception.
Do not use `raise` or `throw` in tests.

## Bad


```python
# File: tests/domain/test_reader.py
import unittest
class TestReader(unittest.TestCase):
    def test_rejects_invalid_data(self) -> None:
        raise ValueError("invalid data")  # <- error
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    try:
        read()
    except ValueError as error:
        print(error)
```
