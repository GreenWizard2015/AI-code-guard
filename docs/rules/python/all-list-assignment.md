# Python `__all__` Literal List

Description: Declare exports only with one direct assignment to a list of string literals. Do not annotate, concatenate, alias, or mutate `__all__`.

## Bad

```python
__all__ = ["Client"]
__all__ += ["Worker"]  # <- error
```

## Good

```python
__all__ = ["Client", "Worker"]
```
