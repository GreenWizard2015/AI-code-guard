from __future__ import annotations

import ast
from typing import Protocol, Sequence

from implementation.rules.types import AliasWalkStateDataContract
from implementation.types import JsonObject


class PythonMethodRecordContract(Protocol):
    """Responsibilities: _method temporal record contract_."""

    def method_name(self) -> str: ...

    def syntax_node(self) -> ast.AST: ...

    def written_set(self) -> set[str]: ...

    def access_set(self) -> set[str]: ...


class PythonCacheReadStateContract(Protocol):
    """Responsibilities: _cache key state_."""

    def record(self, receiver: str, key: str) -> None:
        """Responsibilities: _cache read recording_."""
        ...

    def keys_for(self, receiver: str) -> set[str]:
        """Responsibilities: _receiver key lookup_."""
        ...

    def entries(self) -> set[str]:
        """Responsibilities: _branch state snapshot_."""
        ...

    def merge(
        self, states: list[PythonCacheReadStateContract]
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _branch state combination_."""
        ...


class PythonCacheDiagnosticsContract(Protocol):
    """Responsibilities: _cache diagnostic collection contract_."""

    def clear(self) -> None:
        """Responsibilities: _diagnostic state reset_."""
        ...

    def append(self, line: int) -> None:
        """Responsibilities: _cache diagnostic recording_."""
        ...

    def values(self) -> list[JsonObject]:
        """Responsibilities: _cache diagnostic results_."""
        ...


class PythonCacheNodeExecutionContract(Protocol):
    """Responsibilities: _cache AST execution order_."""

    def analyze_node(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract: ...

    def analyze_nodes(
        self, nodes: Sequence[ast.AST], state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract: ...


class AliasWalkStateContract(Protocol):
    """Responsibilities: _alias traversal contract_."""

    def snapshot(self) -> AliasWalkStateDataContract: ...

    def known_result(self) -> AliasWalkStateContract: ...

    def with_result(self, result: ast.expr) -> AliasWalkStateContract: ...

    def visit(self, source: str) -> AliasWalkStateContract: ...

    def cycle_result(self, cycle_start: int) -> AliasWalkStateContract: ...


class BranchSummaryContract(Protocol):
    """Responsibilities: _branch-chain summary contract_."""

    def length(self) -> int:
        """Responsibilities: _branch-chain length access_."""
        ...

    def all_same(self) -> bool:
        """Responsibilities: _branch condition equality access_."""
        ...

    def prepend(self, name: str) -> BranchSummaryContract:
        """Responsibilities: _immutable branch summary extension_."""
        ...
