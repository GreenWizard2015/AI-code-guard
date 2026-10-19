# `broad-except`

Description: Broad catches hide unrelated programming failures.

```python
try:
    run()
except Exception:
    recover()
```

TypeScript catches without a specific error boundary are also reported:


Fix: Catch only the expected exception at the I/O, network, process, or JSON boundary.

## Bad


```python
try:
    read()
except Exception:
    pass
```

## Good


```python
try:
    read()
except ValueError as error:
    raise RuntimeError("read failed") from error
```
