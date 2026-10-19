# `numeric-name`

Description: Names of project-owned symbols must not contain numbers. This applies to
classes, types, fields, methods, functions, parameters, and local variables in
both TypeScript and Python.


Use a descriptive word instead:


The rule does not inspect test files, consistent with the project policy that
test names and test-local naming are outside naming checks. External runtime
names are not declarations owned by the project and are not renamed by this
rule.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    item1 = 1
    print(item1)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    item_count: int = 1
    print(item_count)
```
