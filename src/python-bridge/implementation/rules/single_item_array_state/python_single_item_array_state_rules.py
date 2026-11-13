from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE
from implementation.rules.protocols import PythonArrayCallAnalyzerContract
from implementation.types import JsonObject


class PythonSingleItemArrayStateRules:
    """Responsibilities: _identification single-item array invocation_, _array violations collection_."""

    def _single_item_target(self, targets: list[ast.expr]) -> bool:
        """Responsibilities: _single-item destructuring detection_."""
        for target in targets:
            if type(target) is ast.Tuple:
                elements = target.elts
            else:
                if type(target) is ast.List:
                    elements = target.elts
                else:
                    continue
            if len(elements) == 1:
                return True
        return False

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
        match node:
            case ast.Assign(lineno=line, targets=targets):
                pass
            case ast.AnnAssign(lineno=line, target=target):
                targets = [target]
            case ast.Subscript() as indexed_expression:
                return self.collect_indexed_result(indexed_expression)
            case _:
                return []
        if self._single_item_target(targets):
            return [{"line": line - 1, "kind": PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE}]
        return []

    def collect_indexed_result(self, indexed_expression: ast.Subscript) -> list[JsonObject]:
        """Responsibilities: _single-item indexed result diagnostics_."""
        if not self._call_analyzer.array_call(indexed_expression):
            return []
        return [
            {
                "line": indexed_expression.lineno - 1,
                "kind": PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE,
            },
        ]
