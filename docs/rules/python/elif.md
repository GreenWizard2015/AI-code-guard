# `elif`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: cli.py
if __name__ == "__main__":
    ready = True
    blocked = False
    if ready:
        print("first")
    elif blocked:
        print("second")
    else:
        print("other")
```

**Purpose:** Explicit nested branches make each scope visible. Put the second `if` inside `else`.

## Good

```python
# File: cli.py
if __name__ == "__main__":
    ready = True
    blocked = False
    if ready:
        print("first")
    else:
        if blocked:
            print("second")
        else:
            print("other")
```
