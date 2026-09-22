from __future__ import annotations

import ast
from typing import Any

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.rules.single_item_array_state.array_type import (
    PythonArrayTypeInspector,
)
from implementation.rules.single_item_array_state.return_analysis import (
    PythonReturnArrayAnalyzer,
)
from implementation.rules.single_item_array_state.call_analysis import (
    PythonArrayCallAnalyzer,
)
from implementation.types import JsonObject


class PythonSingleItemArrayStateRules:
    """Responsibilities: _identification single-item array invocation_, _array violations collection_."""

    def _violation(self, node: ast.Subscript) -> JsonObject:
        """Responsibilities: _construction single-item array violation_."""
        line: Any = node.lineno - 1
        kind: Any = "single-item-array-state"
        return {"line": line, "kind": kind}

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization array type output_, _initialization invocation analyzer_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        type_inspector: Any = PythonArrayTypeInspector(frozenset({"list", "List"}))
        return_analyzer: Any = PythonReturnArrayAnalyzer()
        self.call_analyzer: Any = PythonArrayCallAnalyzer(
            tree,
            node_index,
            type_inspector,
            return_analyzer,
        )

    def collect_array_rules(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection violations AST node_."""
        if type(node) is not ast.Subscript:
            return []
        if not self.single_array(node):
            return []
        return [self._violation(node)]

    def single_array(self, node: ast.AST) -> bool:
        """Responsibilities: _identification single-item array invocation_."""
        if type(node) is not ast.Subscript:
            return False
        return self.call_analyzer.array_call(node)
