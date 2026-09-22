# `class-interface-count`

**Purpose:** Keep one class focused by limiting it to three implemented interfaces or protocols.

```ts
class Adapter implements FirstPort, SecondPort, ThirdPort, FourthPort {}
```

```python
class Adapter(FirstPort, SecondPort, ThirdPort, FourthPort):
    pass
```

**Fix:** Split the class into focused adapters or collaborators. Each class should implement at most three interfaces or protocols.
