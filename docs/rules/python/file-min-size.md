# `file-min-size`

Description: Detect files too small to justify a separate module boundary.
An implementation file with exactly one class and its matching class-derived file name is exempt because the single-class file rule requires that dedicated module boundary.


Fix: Merge the file into the focused neighboring module or move meaningful ownership into it. Do
not keep a thin wrapper only to preserve a file split.

## Bad


```python
def read_value() -> str:
    first = get_first()
    second = get_second()
    return first + second
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
