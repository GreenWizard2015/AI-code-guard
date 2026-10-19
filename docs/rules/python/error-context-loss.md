# error-context-loss

Description: Reports only explicit exception-context suppression:

- TypeScript catches a named error and throws a new `*Error` without using the
  caught error, its message, or a `cause` property.
- Python uses `raise ... from None` inside an exception handler.

Rethrowing the original error, passing it to the new error, and ordinary
boundary translation remain allowed.

## Bad


```python
try:
    return parse_document(text)
except ValueError:
    raise DocumentError("Invalid document") from None
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    try:
        raise ValueError("source failure")
    except ValueError as error:
        raise RuntimeError("Invalid document") from error
```
