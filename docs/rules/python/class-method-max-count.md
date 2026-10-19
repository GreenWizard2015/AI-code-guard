# `class-method-max-count`

Description: An implementation class must not expose more than fifteen public or non-public
methods. Refactor excess operations into focused domain collaborators; do not
retain unrelated operations in a namespace-like class.

## Bad


```python
class StatusLabels:
    def member_status(self) -> str: return "member"
    def group_status(self) -> str: return "group"
    def page_status(self) -> str: return "page"
    def post_status(self) -> str: return "post"
    def photo_status(self) -> str: return "photo"
    def video_status(self) -> str: return "video"
    def event_status(self) -> str: return "event"
    def comment_status(self) -> str: return "comment"
    def reaction_status(self) -> str: return "reaction"
    def message_status(self) -> str: return "message"
    def thread_status(self) -> str: return "thread"
    def story_status(self) -> str: return "story"
    def album_status(self) -> str: return "album"
    def notification_status(self) -> str: return "notification"
    def attachment_status(self) -> str: return "attachment"
    def contact_status(self) -> str: return "contact"
```

## Good


```python
# File: src/status_labels/status_labels.py
class StatusLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self.labels: dict[str, str] = labels
        self.fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self.labels:
            return self.labels[status]
        return self.fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self.labels:
            if status_name:
                count += 1
        return count
# File: cli.py
from status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    print(f"{label} {detailed} {fallback} {count}")
```
