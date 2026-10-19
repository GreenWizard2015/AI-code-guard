# `assignment-expression`

Description: Do not use Python's `:=` assignment expression. Assign the value in
a separate statement so that assignment is visible and separate from expression
evaluation.

## Bad

```python
# File: cli.py
if __name__ == "__main__":
    message = "ready"
    if match := message.strip():  # <- error
        print(match)
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    message = "ready"
    match = message.strip()
    if match:
        print(match)
```
