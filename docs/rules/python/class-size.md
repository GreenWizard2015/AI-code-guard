# `class-size`

Description: Classes whose combined body-size metric is outside the configured range indicate weak
ownership.


### Fix

Split the class by cohesive capabilities without adding placeholder methods or hiding the original class behind wrappers.

## Bad


```python
{% const statuses = [{"name":"member","value":"member"},{"name":"group","value":"group"},{"name":"page","value":"page"},{"name":"post","value":"post"},{"name":"photo","value":"photo"},{"name":"video","value":"video"},{"name":"event","value":"event"},{"name":"comment","value":"comment"},{"name":"_reaction","value":"reaction"},{"name":"_message","value":"message"},{"name":"_thread","value":"thread"},{"name":"_story","value":"story"},{"name":"_album","value":"album"},{"name":"_notification","value":"notification"},{"name":"_attachment","value":"attachment"},{"name":"_contact","value":"contact"},{"name":"search","value":"search"},{"name":"billing","value":"billing"},{"name":"audit","value":"audit"},{"name":"access","value":"access"},{"name":"settings","value":"settings"},{"name":"export","value":"export"}] %}
# File: src/status_labels.py
class StatusLabels:
{%for status in statuses %}
    def {{status.name}}_status(self) -> str:
        return "{{status.value}}"
{% endfor %}
    def report(self) -> None:
        statuses = [
            self.member_status(),
            self.group_status(),
            self.page_status(),
            self.post_status(),
            self.photo_status(),
            self.video_status(),
            self.event_status(),
            self.comment_status(),
            self._reaction_status(),
            self._message_status(),
            self._thread_status(),
            self._story_status(),
            self._album_status(),
            self._notification_status(),
            self._attachment_status(),
            self._contact_status(),
            self.search_status(),
            self.billing_status(),
            self.audit_status(),
            self.access_status(),
            self.settings_status(),
            self.export_status(),
        ]
        print(" | ".join(statuses))
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    status_labels = StatusLabels()
    status_labels.report()
```

## Good


```python
# File: src/status_labels/status_labels.py
class StatusLabels:
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
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
