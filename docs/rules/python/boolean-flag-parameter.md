# boolean-flag-parameter

Description: Reports a production TypeScript or Python callable with at least two explicitly
typed boolean parameters, including annotations that resolve through local type
aliases. A single boolean parameter is allowed. Test files are not checked by
this rule.

Replace independent positional flags with a named options or state object so
the call expresses each mode explicitly.

## Bad


```python
# File: src/article_publisher.py
class ArticlePublisher:
    """Responsibilities: _article publication_."""

    def __init__(self, channel: str) -> None:
        """Responsibilities: _publisher initialization_."""
        self._channel: str = channel

    def publish(self, article: str, notify: bool, dry_run: bool) -> str:
        """Responsibilities: _publication decision_."""
        normalized_article = article.strip()
        if dry_run:
            return f"Preview: {normalized_article}"
        if notify:
            return f"{self._channel}: {normalized_article}"
        return f"Stored: {normalized_article}"

    def summary(self) -> str:
        """Responsibilities: _publication summary formatting_."""
        return self.publish("Release notes", True, False)

    def report(self) -> None:
        """Responsibilities: _publication report output_."""
        print(self.summary())
# File: cli.py
from src.article_publisher import ArticlePublisher

if __name__ == "__main__":
    publisher = ArticlePublisher("Notification")
    publisher.report()
```

## Good


```python
# File: src/constants.py
ARTICLE_TEXT = "Release notes"
DRY_RUN_OPTION = "dry_run"
NOTIFY_OPTION = "notify"
PREVIEW_PREFIX = "Preview: "
NOTIFICATION_PREFIX = "Notification: "
STORAGE_PREFIX = "Stored: "
PREVIEW_MODE = "Preview mode"
NOTIFICATION_MODE = "Notification mode"
STORAGE_MODE = "Storage mode"
# File: src/article_publisher.py
from src.constants import (
    ARTICLE_TEXT,
    DRY_RUN_OPTION,
    NOTIFY_OPTION,
    NOTIFICATION_MODE,
    NOTIFICATION_PREFIX,
    PREVIEW_MODE,
    PREVIEW_PREFIX,
    STORAGE_MODE,
    STORAGE_PREFIX,
)

class ArticlePublisher:
    """Responsibilities: _article publication_."""

    def __init__(self, options: dict[str, bool]) -> None:
        """Responsibilities: _publisher initialization_."""
        self._options: dict[str, bool] = options

    def normalized_article(self, article_text: str) -> str:
        """Responsibilities: _article text normalization_."""
        return " ".join(article_text.split())

    def publish(self, article: str) -> str:
        """Responsibilities: _publication decision_."""
        normalized_article = self.normalized_article(article)
        if self._options[DRY_RUN_OPTION]:
            return f"{PREVIEW_PREFIX}{normalized_article}"
        if self._options[NOTIFY_OPTION]:
            return f"{NOTIFICATION_PREFIX}{normalized_article}"
        return f"{STORAGE_PREFIX}{normalized_article}"

    def delivery_description(self) -> str:
        """Responsibilities: _delivery mode description_."""
        if self._options[DRY_RUN_OPTION]:
            return PREVIEW_MODE
        if self._options[NOTIFY_OPTION]:
            return NOTIFICATION_MODE
        return STORAGE_MODE

    def summary(self) -> str:
        """Responsibilities: _publication summary formatting_."""
        publication = self.publish(ARTICLE_TEXT)
        delivery = self.delivery_description()
        article_size = len(self.normalized_article(ARTICLE_TEXT))
        return f"{publication} | {delivery} | {article_size} characters"

    def report(self) -> None:
        """Responsibilities: _publication report output_."""
        print(self.summary())
# File: cli.py
from src.constants import DRY_RUN_OPTION, NOTIFY_OPTION
from src.article_publisher import ArticlePublisher

if __name__ == "__main__":
    options: dict[str, bool] = {NOTIFY_OPTION: True, DRY_RUN_OPTION: False}
    publisher = ArticlePublisher(options)
    publisher.report()
```
