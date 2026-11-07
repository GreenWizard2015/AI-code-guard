# `method-handle-name`

Description: Review public commands beginning with `handle*`. `handleRequest()` or
`handleEvent()` says only “do something with X”. Prefer the real action, such
as `respond()`, `retry()`, `reject()`, `publish()`, or `store()`. Framework
callback boundaries may legitimately retain `handle`.

## Bad


```python
# File: src/request_handler.py
class RequestHandler:
    def __init__(self, request: str) -> None:
        self._request: str = request

    def handle_request(self) -> str:  # <- error
        return f"Response: {self._request.strip()}"

    def report(self) -> None:
        response = self.handle_request()
        print(response)
# File: cli.py
from src.request_handler import RequestHandler

if __name__ == "__main__":
    handler = RequestHandler("account refresh")
    handler.report()
```

## Good


```python
# File: src/price_labels.py
class PriceLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self._labels:
            return self._labels[status]
        return self._fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self._fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count
    def report(self) -> None:
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.price_labels import PriceLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    price_labels = PriceLabels(labels, "Unknown")
    price_labels.report()
```
