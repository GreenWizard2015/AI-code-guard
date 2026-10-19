from __future__ import annotations

import ast


class PythonMethodRecordValue:
    """Responsibilities: _method syntax_, _field access state_."""

    def __init__(
        self, name: str, node: ast.AST, written: set[str], read: set[str]
    ) -> None:
        """Responsibilities: _method temporal record initialization_."""
        self._name: str = name
        self._node: ast.AST = node
        self._written: set[str] = written
        self._read: set[str] = read

    def method_name(self) -> str:
        """Responsibilities: _method name state_."""
        return self._name

    def syntax_node(self) -> ast.AST:
        """Responsibilities: _method syntax state_."""
        return self._node

    def written_set(self) -> set[str]:
        """Responsibilities: _mutation values_."""
        return self._written

    def access_set(self) -> set[str]:
        """Responsibilities: _field access method state_."""
        return self._read
