# `python-abstract-class`

**Purpose:** Project Python contracts must use structural `Protocol` types or interfaces instead
of abstract base classes.

```py
from abc import ABC, abstractmethod

class UserStore(ABC):  # violation
    @abstractmethod
    def load(self):
        ...
```

**Fix:** Replace the abstract class with a focused `Protocol` and move implementation logic into
a normal class. The rule covers bases named `ABC` or `ABCMeta` and classes declaring
`@abstractmethod`.
