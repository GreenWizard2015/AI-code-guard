from __future__ import annotations


from typing import Any
import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class PythonFieldMutationCollector:
    """Responsibilities: _mutable field assignments identification_, _mutation diagnostics collection_."""

    def _enclosing_method(
        self, node: ast.AST, parents: dict[int, ast.AST]
    ) -> list[ast.AST]:
        """Responsibilities: _enclosing callable lookup_."""
        parent: Any = parents.get(id(node))
        while parent is not None:
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return [parent]
            parent: Any = parents.get(id(parent))
        return []

    def _assignment_targets(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _assignment targets extraction_."""
        if type(node) is ast.Assign:
            return node.targets
        if type(node) is ast.AnnAssign:
            return [node.target]
        if type(node) is ast.AugAssign:
            return [node.target]
        return []

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _AST parent indexes initialization_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.parents: Any = dict(
            (id(child), node)
            for node in self.node_index.nodes(tree)
            for child in ast.iter_child_nodes(node)
        )

    def field_target(self, target: ast.AST) -> bool:
        """Responsibilities: _self field targets identification_."""
        if type(target) is not ast.Attribute:
            return False
        if type(target.value) is not ast.Name:
            return False
        return target.value.id == "self"

    def collect_mutations(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mutable field assignment_."""
        methods: Any = self._enclosing_method(node, self.parents)
        if len(methods) == 0:
            return []
        method: Any = methods[0]
        if method.name in {"__init__", "__post_init__"}:
            return []
        if any(self.field_target(target) for target in self._assignment_targets(node)):
            return [{"line": node.lineno - 1, "kind": "mutable-field-assignment"}]
        return []
