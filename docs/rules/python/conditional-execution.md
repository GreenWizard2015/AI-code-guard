# `conditional-execution`

Description: Avoid hiding side effects inside `&&`, `||`, `??`, `and`, or `or`. Use an
explicit branch when a logical condition controls an operation. Pure boolean
expressions remain valid.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    is_ready = True
    did_send = is_ready and print("message sent")
    print(did_send)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    is_ready = True
    has_message = False
    is_deliverable = is_ready and has_message
    print(is_deliverable)
```
