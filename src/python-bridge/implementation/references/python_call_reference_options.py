from __future__ import annotations

import ast

from implementation.references.protocols import PythonCallBindingContract


class PythonCallReferenceOptions:
    """Responsibilities: _call-site attribution_, _call result binding context_."""

    _node: ast.Call
    _owner: str
    _binding: PythonCallBindingContract

    def __init__(
        self,
        node: ast.Call,
        owner: str,
        binding: PythonCallBindingContract,
    ) -> None:
        """Responsibilities: _call-site reference options initialization_."""
        self._node = node
        self._owner = owner
        self._binding = binding

    def call_node(self) -> ast.Call:
        """Responsibilities: _call AST access_."""
        return self._node

    def caller_owner(self) -> str:
        """Responsibilities: _caller owner access_."""
        return self._owner

    def binding(self) -> PythonCallBindingContract:
        """Responsibilities: _call result binding context_."""
        return self._binding
