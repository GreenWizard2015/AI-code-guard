from __future__ import annotations
from typing import Any

import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.rules.single_item_array_state.array_type import (
    PythonArrayTypeInspector,
)
from implementation.rules.single_item_array_state.return_analysis import (
    PythonReturnArrayAnalyzer,
)


class PythonArrayCallAnalyzer:
    """Responsibilities: _Python array result detection_."""

    def _call_name(self, node: ast.Call) -> str:
        """Responsibilities: _resolution invocation function name_."""
        if type(node.func) is ast.Name:
            return node.func.id
        if type(node.func) is ast.Attribute:
            return node.func.attr
        return ""

    def _callable_declarations(self, name: str) -> list[ast.AST]:
        """Responsibilities: _collection callable declarations matching_."""
        return [
            node
            for node in self.node_index.nodes(self.tree)
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
            and node.name == name
        ]

    def _is_array_declaration(self, declaration: ast.AST) -> bool:
        """Responsibilities: _classification callable output array-like_."""
        if declaration.returns is None:
            return False
        if not self.type_inspector.array_type(declaration.returns):
            return False
        return self.return_analyzer.single_arrays(declaration)

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexProtocol,
        type_inspector: PythonArrayTypeInspector,
        return_analyzer: PythonReturnArrayAnalyzer,
    ) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.type_inspector: Any = type_inspector
        self.return_analyzer: Any = return_analyzer

    def array_call_name(self, node: ast.Subscript) -> str:
        """Responsibilities: _resolution function name usage_."""
        if type(node.value) is not ast.Call:
            return ""
        return self._call_name(node.value)

    def array_call(self, node: ast.Subscript) -> bool:
        """Responsibilities: _reporting indexing targets known_."""
        name: Any = self.array_call_name(node)
        if not name:
            return False
        return any(
            self._is_array_declaration(declaration)
            for declaration in self._callable_declarations(name)
        )
