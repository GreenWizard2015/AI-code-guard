# `property`

Description: Keep behavior explicit. Python `@property` hides a method call behind attribute access.

```python
# File: src/service/service.py
class Service:
    loader: Loader

    def __init__(self, loader: Loader):
        self.loader = loader

    @property
    def status(self):
        return self.load_status()
```


Fix: Replace the property with an explicitly named method, such as `status()`.

`@cached_property` is not covered by this rule.

## Bad

```python
# File: src/service/service.py
class Service:
    @property
    def status(self) -> str:
        return "ready"
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
