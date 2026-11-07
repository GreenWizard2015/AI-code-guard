from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE
from implementation.rules.protocols import PythonArrayCallAnalyzerContract
from implementation.types import JsonObject


class PythonSingleItemArrayStateRules:
    """Responsibilities: _identification single-item array invocation_, _array violations collection_."""

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        call_analyzer: PythonArrayCallAnalyzerContract,
    ) -> None:
        """Responsibilities: _initialization array type output_, _initialization invocation analyzer_."""
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._call_analyzer: PythonArrayCallAnalyzerContract = call_analyzer

    def collect_array_rules(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection violations AST node_."""
        targets: list[ast.expr] = []
        if type(node) is ast.Assign:
            targets = node.targets
        else:
            if type(node) is ast.AnnAssign:
                targets = [node.target]
        for target in targets:
            if type(target) is ast.Tuple or type(target) is ast.List:
                if len(target.elts) == 1:
                    return [{"line": node.lineno - 1, "kind": PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE}]
        if type(node) is not ast.Subscript:
            return []
        return self.collect_indexed_result(node)

    def collect_indexed_result(self, indexed_expression: ast.Subscript) -> list[JsonObject]:
        """Responsibilities: _single-item indexed result diagnostics_."""
        if not self._call_analyzer.array_call(indexed_expression):
            return []
        return [{"line": indexed_expression.lineno - 1, "kind": PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE}]
