# `python-string-type-annotation`

Python type annotations must use direct expressions instead of quoted strings.

Bad:

```py
class Service:
    model: "Model"

    def load(self, value: "Model") -> "Model":
        return value
```

Good:

```py
class Service:
    model: Model

    def load(self, value: Model) -> Model:
        return value
```

Use an import or a module layout that makes the type name available directly.
