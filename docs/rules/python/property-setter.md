# `property-setter`

Description: Setters hide state transitions and weaken immutability.

```python
item.name = value
```


Fix: Return a new value or expose an explicit transition such as `with_name(value)`.

## Bad

```python
# File: src/profile/profile.py
class Profile:
    def __init__(self, name: str) -> None:
        self.name: str = name

    @property
    def name(self) -> str:
        return self._name

    @name.setter
    def name(self, value: str) -> None:
        self._name = value
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
