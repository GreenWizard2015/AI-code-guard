from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonInstanceFieldNames:
    """Responsibilities: _annotated instance fields_, _instance target matching_."""

    def __init__(
        self, node: ast.ClassDef, node_index: PythonAstNodeIndexContract
    ) -> None:
        """Responsibilities: _instance field name state_."""
        self.node: ast.ClassDef = node
        self.node_index: PythonAstNodeIndexContract = node_index

    def instance_target(self, target: ast.AST) -> bool:
        """Responsibilities: _instance field target classification_."""
        if type(target) is not ast.Attribute:
            return False
        if type(target.value) is not ast.Name:
            return False
        return target.value.id in ("self", "cls")

    def names(self) -> set[str]:
        """Responsibilities: _annotated instance field collection_."""
        names: set[str] = set()
        for item in self.node.body:
            if type(item) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            for nested in self.node_index.nodes(item):
                if type(nested) is not ast.AnnAssign:
                    continue
                if not self.instance_target(nested.target):
                    continue
                names.add(nested.target.attr)
        return names
