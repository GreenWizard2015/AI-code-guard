# `unused-constant`

Description: Reports a module-level constant with no production symbol usage. Remove dead
configuration or vocabulary, or add a real production consumer.

## Bad


```python
# File: constants.py
READ_FAILURE_MESSAGE = "request failed"  # <- error
```

## Good


```python
# File: constants.py
READ_FAILURE_MESSAGE = "request failed"
# File: cli.py
from constants import READ_FAILURE_MESSAGE
if __name__ == "__main__":
    print(READ_FAILURE_MESSAGE)
```
