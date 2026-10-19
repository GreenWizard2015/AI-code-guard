# `setattr`

Description: Dynamic assignment hides which state changes.

```python
setattr(item, "name", value)
```

The equivalent TypeScript dynamic assignment is also rejected:


Fix: Assign an explicit field or use a named state-transition method.

## Bad


```python
setattr(item, name, value)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    item.name = value
```
