# `duplicate-error-translation`

Description: Reports a production `catch` or `except` handler that constructs the identical
error translation more than once. Preserve meaningful differences in error
category or context; merge paths that produce the same result.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    try:
        raise ValueError("source failure")
    except ValueError as error:
        if isinstance(error, ValueError):
            retry_message = "document parsing failed"
            raise RuntimeError(retry_message)
        fallback_message = "document parsing failed"
        raise RuntimeError(fallback_message)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    try:
        raise ValueError("source failure")
    except ValueError as error:
        raise RuntimeError("document parsing failed") from error
```
