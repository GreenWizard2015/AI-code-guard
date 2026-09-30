from __future__ import annotations
from typing import cast

from implementation.references.protocols import PythonCallReturnStateProtocol


class PythonCallReturnStateAdapter:
    """Responsibilities: _ownership state compatibility_."""

    def __init__(self, source: PythonCallReturnStateProtocol) -> None:
        """Responsibilities: _ownership source assignment_."""
        self._source: PythonCallReturnStateProtocol = source

    def value(self, key: str) -> str:
        """Responsibilities: _ownership owner access_."""
        if type(self._source) is dict:
            source = cast(dict[str, str], self._source)
            return source.get(key, "")
        return self._source.value(key)

    def store(self, key: str, owner: str) -> None:
        """Responsibilities: _ownership owner storage_."""
        if type(self._source) is dict:
            source = cast(dict[str, str], self._source)
            source[key] = owner
            return
        self._source.store(key, owner)

    def state_cleanup(self) -> None:
        """Responsibilities: _state cleanup_."""
        if type(self._source) is dict:
            source = cast(dict[str, str], self._source)
            source.clear()
            return
        self._source.state_cleanup()
