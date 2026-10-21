# empty-error-handler

Description: Reports an empty TypeScript `catch` block or a Python `except` block containing
only `pass` or a standalone string. Handle, rethrow, or explicitly transform
the error instead. A handler with real recovery or reporting code is not
reported. Idempotent filesystem operations that suppress only the expected
missing-file or already-exists race are not reported.

## Bad


```python
try:
    load_config()
except OSError:
    pass
```

## Good


```python
try:
    load_config()
except OSError as error:
    raise ConfigError("Configuration cannot be loaded") from error
```
