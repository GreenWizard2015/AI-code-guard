# boolean-flag-parameter

Description: Reports a production TypeScript or Python callable with at least two explicitly
typed boolean parameters. A single boolean parameter is allowed. Test files are
not checked by this rule.

Replace independent positional flags with a named options or state object so
the call expresses each mode explicitly.

## Bad


```python
def publish(article: Article, notify: bool, dry_run: bool) -> None:
    pass

publish(article, True, False)
```

## Good


```python
# File: src/publication_policy/publication_policy.py
class PublicationPolicy:
    """Responsibilities: _publication capability_."""

    def __init__(self, mode: str) -> None:
        """Responsibilities: _publication mode initialization_."""
        self.mode: str = mode

    def publishable(self) -> bool:
        """Responsibilities: _publication capability decision_."""
        return self.mode == "notify"

    def delivery_description(self) -> str:
        """Responsibilities: _delivery mode description_."""
        normalized_mode = self.mode.strip()
        return normalized_mode.upper()

    def delivery_channel(self) -> str:
        """Responsibilities: _delivery channel selection_."""
        if self.mode == "notify":
            return "email"
        if self.mode == "preview":
            return "preview"
        return "none"
# File: cli.py
from publication_policy.publication_policy import PublicationPolicy

if __name__ == "__main__":
    publication_policy = PublicationPolicy("preview")
    publishable = publication_policy.publishable()
    delivery_mode = publication_policy.delivery_description()
    channel = publication_policy.delivery_channel()
    print(f"{publishable} {delivery_mode} {channel}")
```
