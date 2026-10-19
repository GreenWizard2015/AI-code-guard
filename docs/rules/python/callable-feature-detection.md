# `callable-feature-detection`

Description: Do not use `callable(...)` as a fallback for project-owned interfaces. Check only
calls inside conditional control flow; ordinary callable values at external boundaries are not
the target.

## Bad

```python
if __name__ == "__main__":
    if callable(client.run):
        client.run()
```

## Good

```python
if __name__ == "__main__":
    client.run()
```
