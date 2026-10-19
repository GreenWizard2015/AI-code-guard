# `mixed-arithmetic-precedence`

Description: Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, `/`, `%`, `//`, and `**` in one ungrouped expression. Parentheses around a larger expression do not hide a mixed expression inside that group.

## Bad


```python
if __name__ == "__main__":
    first = 12
    second = 3
    third = 2
    total = first + second / third
    delta = first + second - third
    remainder = first + second % third
    floor = first // second - third
    print(f"{total} {delta} {remainder} {floor}")
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    first = 12
    second = 3
    third = 2
    total = first + (second / third)
    delta = (first + second) - third
    remainder = first + (second % third)
    floor = (first // second) - third
    print(f"{total} {delta} {remainder} {floor}")
```
