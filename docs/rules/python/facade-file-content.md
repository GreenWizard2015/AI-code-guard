# `facade-file-content`

Description: Facade files such as `index.ts` and `__init__.py` may contain imports and re-exports only.

## Bad


```python
# File: src/__init__.py
class Service:
    pass
```

## Good


```python
# File: src/__init__.py
```
