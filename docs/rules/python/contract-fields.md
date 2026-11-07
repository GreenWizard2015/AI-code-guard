# Interface And Protocol Fields

Description: See the examples below for the rule behavior.

### Purpose

Python `Protocol` classes define behavior boundaries. Writable attributes put state in the
contract and force every implementation to share representation. Expose values through methods.

### Preferred


```python
class UserStore(Protocol):
    def get(self, user_id: str) -> str: ...

class InMemoryUserStore:
    def __init__(self) -> None:
        self._cache: dict[str, str] = {}

    def get(self, user_id: str) -> str:
        return self._cache.get(user_id, '')
```

## Bad


```python
# File: src/protocols.py
from typing import Protocol

class UserStoreContract(Protocol):
    cache: dict[str, str]

    def get(self, user_id: str) -> str: ...
# File: src/user_store/user_store.py
from src.protocols import UserStoreContract

class UserStore(UserStoreContract):
    def __init__(self, name: str) -> None:
        self.cache: dict[str, str] = {"u-1": "Ada"}
        self.name: str = name

    def get(self, user_id: str) -> str:
        return self.cache.get(user_id, "missing")

    def report(self) -> None:
        print(f"{self.name}: {self.get('u-1')}")
# File: cli.py
from src.user_store.user_store import UserStore

if __name__ == "__main__":
    store = UserStore("directory")
    store.report()
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class KnowledgeArticleContract(Protocol):
    """Responsibilities: _knowledge article behavior contract_."""

    def heading(self) -> str: ...
    def normalized_content(self) -> str: ...
    def content_length(self) -> int: ...
# File: src/knowledge_article.py
from src.protocols import KnowledgeArticleContract

class KnowledgeArticle(KnowledgeArticleContract):
    """Responsibilities: _knowledge article management_."""

    def __init__(self, title: str, content: str) -> None:
        """Responsibilities: _article initialization_."""
        self._title: str = title
        self._content: str = content

    def heading(self) -> str:
        """Responsibilities: _article heading formatting_."""
        return self._title.strip().upper()

    def normalized_content(self) -> str:
        """Responsibilities: _article content normalization_."""
        return " ".join(self._content.split())

    def content_length(self) -> int:
        """Responsibilities: _article length calculation_."""
        content = self._content.strip()
        length = 0
        for character in content:
            length += 1
        return length

    def report(self) -> None:
        """Responsibilities: _article report output_."""
        content = self.normalized_content()
        heading = self.heading()
        length = self.content_length()
        line = f"{heading}: {content} ({length} characters)"
        print(line)
# File: cli.py
from src.knowledge_article import KnowledgeArticle

if __name__ == "__main__":
    article = KnowledgeArticle("Release notes", "ready")
    article.report()
```
