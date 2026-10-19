# `direct-class-init`

Description: Direct `Class.__init__` calls bypass normal construction and inheritance invariants.

```python
Base.__init__(self, value)
```


Fix: Use `super().__init__(value)` inside a subclass or construct the object normally.

## Bad

```python
class Base:
    def __init__(self, value: str) -> None:
        self.value = value

class Child(Base):
    def __init__(self, value: str) -> None:
        Base.__init__(self, value)
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
