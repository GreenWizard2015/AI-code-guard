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
            raise RuntimeError("document parsing failed")
        raise RuntimeError("document parsing failed")
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
