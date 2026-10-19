from __future__ import annotations

from implementation.rules.protocols import PythonCacheReadStateContract


class PythonCacheReadState(PythonCacheReadStateContract):
    """Responsibilities: _cache key state_, _branch state merge_."""

    _entries: set[str]

    def __init__(self, entries: set[str]) -> None:
        """Responsibilities: _cache key storage_."""
        self._entries: set[str] = set(entries)

    def record(self, receiver: str, key: str) -> None:
        """Responsibilities: _cache key registration_."""
        self._entries.add(f"{receiver}\u0000{key}")

    def keys_for(self, receiver: str) -> set[str]:
        """Responsibilities: _cache key lookup_."""
        prefix = f"{receiver}\u0000"
        return {
            entry[len(prefix) :] for entry in self._entries if entry.startswith(prefix)
        }

    def entries(self) -> set[str]:
        """Responsibilities: _branch observation snapshot_."""
        return set(self._entries)

    def merge(
        self, states: list[PythonCacheReadStateContract]
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _alternative state combination_."""
        merged_entries: set[str] = set()
        for state in states:
            merged_entries.update(state.entries())
        return PythonCacheReadState(merged_entries)
