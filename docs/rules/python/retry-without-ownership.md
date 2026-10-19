# retry-without-ownership

Description: Reports a production `while (true)` loop that calls an operation inside a
`try` block and continues from its error handler without an attempt limit. The
rule is deliberately narrower than a general retry scan: bounded loops, test
files, and loops without an operation are allowed. A deliberate worker loop
with this exact retry shape must still expose its retry ownership explicitly.

TypeScript:


Python:

```python
while True:
    try:
        request()
    except OSError:
        continue
```

Add an attempt owner with a limit, backoff, or explicit recovery state.

## Bad


```python
while True:
    try:
        request()
    except OSError:
        continue
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
