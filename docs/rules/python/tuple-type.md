# `tuple-type`

Description: Detect TypeScript tuple type contracts, including readonly and labelled tuples.

Tuples expose data through positional indexes. This makes a result harder to understand and
allows callers to depend on ordering instead of a named contract.

## Bad


```python
if __name__ == "__main__":
    coordinates: tuple[int, int] = (10, 20)  # <- error
    print(coordinates[0], coordinates[1])
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    coordinates: list[int] = [10, 20]
    print(coordinates[0], coordinates[1])
```
