# `mixed-boolean-precedence`

Description: Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`. Also group negation before a comparison when its scope is not explicit.

## Bad


```python
ready = first and second or third
has_items = first or second or count > 0
different = not value == expected
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    first = True
    second = False
    third = True
    value = "ready"
    expected = "ready"
    ready = first and (second or third)
    different = not (value == expected)
    print(f"{ready} {different}")
```
