# `file-max-size`

Description: Detect source files that exceed 500 raw source lines, including comments, blank lines,
docstrings, and test files.


Fix: Split the file by ownership into focused modules. Do not hide file size behind wrappers or
generated-looking padding.

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
