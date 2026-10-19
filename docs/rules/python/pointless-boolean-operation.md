# pointless-boolean-operation

Description: Reports a boolean identity comparison whose only body action is returning.
The syntax differs by language, but the hack is the same: a direct boolean
value is hidden behind a branch that adds no behavior.

## Bad

```python
# File: cli.py
def is_ready(value: bool) -> bool:
    if value is True:
        return True
    return False
if __name__ == "__main__":
    result = is_ready(True)
```


## Good

```python
# File: cli.py
def is_ready(value: bool) -> bool:
    return value
if __name__ == "__main__":
    result = is_ready(True)
```

