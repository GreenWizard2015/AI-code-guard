# `call-method`

Description: `__call__` makes an operation unclear at call sites.

```python
class Runner:
    result: Result

    def __init__(self, result: Result):
        self.result = result

    def __call__(self) -> Result: ...
```


Fix: Expose a descriptive method such as `run()` or `resolve()`.

## Bad

```python
# File: src/linting/runner.py
class Runner:
    def __call__(self) -> str:
        return "ready"
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
