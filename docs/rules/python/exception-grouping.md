# `exception-grouping`

Description: A one-use exception should stay close to the caller that handles it.

```python
class NetworkError(Exception): pass
```

## Bad


```python
class NetworkError(Exception): pass
```

**Fix:** Move the `Error` class into its caller module, or group related exceptions in one
focused module. Do not keep a one-use exception isolated in its own file.


## Good


```python
# File: cli.py
if __name__ == "__main__":
    try:
        read()
    except ValueError as error:
        raise RuntimeError("read failed") from error
```
