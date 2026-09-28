from __future__ import annotations


class PythonCallReturnState:
    """Responsibilities: _ownership state storage_."""

    def __init__(self) -> None:
        """Responsibilities: _ownership state initialization_."""
        self._values: dict[str, str] = {}

    def contains(self, key: str) -> bool:
        """Responsibilities: _ownership key presence_."""
        return key in self._values

    def value(self, key: str) -> str:
        """Responsibilities: _ownership owner access_."""
        if self.contains(key):
            return self._values[key]
        return ""

    def store(self, key: str, owner: str) -> None:
        """Responsibilities: _ownership owner storage_."""
        self._values[key] = owner

    def state_cleanup(self) -> None:
        """Responsibilities: _ownership state clearing_."""
        if not self._values:
            return
        self._values.clear()
