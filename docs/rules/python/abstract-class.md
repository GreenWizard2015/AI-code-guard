# `abstract-class`

Description: Project Python contracts must use structural `Protocol` types or interfaces instead
of abstract base classes.

```python
from abc import ABC, abstractmethod

class UserStore(ABC):  # violation
    @abstractmethod
    def load(self):
        ...
```


Fix: Replace the abstract class with a focused `Protocol` and move implementation logic into
a normal class. The rule covers bases named `ABC` or `ABCMeta` and classes declaring
`@abstractmethod`.

## Bad

```python
from abc import ABC, abstractmethod

class UserStore(ABC):
    @abstractmethod
    def fetch_user(self, user_id: str) -> str: ...
```

## Good

```python
class ReaderContract(Protocol):
    def content_text(self) -> str: ...
```
