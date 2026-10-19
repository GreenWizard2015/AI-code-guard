# `logical-chain-size`

Description: Logical conditions with more than three parts or at least 100 significant characters are difficult to name,
review, and reuse. The rule counts the operands in a connected TypeScript `&&`, `||`, or `??`
expression and Python `and` or `or` expression. A single operand is ignored because it is not a
logical chain. Significant characters are counted with the same whitespace-insensitive metric used by callable-size checks. Mixed nested logical operators are counted as one chain, and only the outer
expression is reported.


### Fix

Extract the condition into a named boolean variable or a predicate method, then use that
name at the decision or return boundary.


```python
can_publish = has_name and has_type and is_active and is_visible
return can_publish
```

## Bad


```python
def can_publish(has_name: bool, has_type: bool, is_active: bool, is_visible: bool) -> bool:
    return has_name and has_type and is_active and is_visible
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    is_ready = True
    has_value = True
    ready = is_ready and has_value
    print(ready)
```
