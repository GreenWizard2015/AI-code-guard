from __future__ import annotations

from implementation.types import PythonProxyAliasRecords


class PythonProxyScopeAliasIndex:
    """Responsibilities: _line-scoped alias lookup_, _receiver name resolution_."""

    def __init__(self, records: PythonProxyAliasRecords) -> None:
        """Responsibilities: _receiver alias index initialization_."""
        self._records: PythonProxyAliasRecords = records

    def value(self, name: str, line: int) -> str:
        """Responsibilities: _source-position alias lookup_."""
        records = self._records.get(name)
        if records is None:
            return ""
        lower = 0
        upper = len(records)
        while lower < upper:
            middle = (lower + upper) // 2
            if records[middle][0] <= line:
                lower = middle + 1
            else:
                upper = middle
        if lower == 0:
            return ""
        return records[lower - 1][2]

    def resolve(self, name: str, line: int) -> str:
        """Responsibilities: _receiver alias-chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved not in seen:
            seen.add(resolved)
            value = self.value(resolved, line)
            if not value:
                break
            resolved = value
        return resolved
