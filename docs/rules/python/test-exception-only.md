# `test-exception-only`

Description: Tests must verify a result or observable behavior. A test that only checks
that an operation throws verifies an implementation detail instead of the
behavior visible to its caller.

Bad:


```python
def test_rejects_invalid_request(self) -> None:
    with self.assertRaises(ValueError):
        self.request_handler.handle(invalid_request)
```

Prefer testing the next public boundary and asserting its result:


If a direct return value does not exist, assert the observable response,
state change, emitted event, or persisted record at the next level above the
implementation under test.

## Bad


```python
# File: tests/domain/test_reader.py
import unittest
class TestReader(unittest.TestCase):
    def test_rejects_invalid_request(self) -> None:
        self.assertRaises(ValueError, read)  # <- error
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    print(read())
```
