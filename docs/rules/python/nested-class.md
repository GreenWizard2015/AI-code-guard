# `nested-class`

Description: Nested classes hide ownership and make dependencies harder to discover.


## Bad


```python
# File: src/service/service.py
class Service:
    class State:
        pass
```

**Fix:** Move the class to a focused top-level module or use composition. Dataclasses and
exception classes remain valid small-file owners.

```python
class Service:
    class State:
        pass
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
