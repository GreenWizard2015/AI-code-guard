# `naming-private`

Description: Names must not begin with `_`.

Allowed exceptions:

- fields;
- private methods;
- names made only of underscores, such as `_` or `__`.

This applies to module-level symbols, parameters, types, classes, public and protected methods, and local variables. Do not hide a leading underscore behind an alias.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    _item_count = 1
    print(_item_count)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    item_count: int = 1
    print(item_count)
```
