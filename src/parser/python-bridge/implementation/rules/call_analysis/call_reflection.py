from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.rules.builtin_reflection import PythonBuiltinReflectionNames
from implementation.types import JsonObject


class PythonCallReflection:
    """Responsibilities: _Python reflection classification_."""

    def _condition_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _conditional feature detection_."""
        if type(parent) not in (ast.If, ast.While, ast.IfExp, ast.Assert):
            return False
        return any(item is target for item in ast.walk(parent.test))

    def _match_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _match feature detection_."""
        if type(parent) is not ast.match_case:
            return False
        if parent.guard is None:
            return False
        return any(item is target for item in ast.walk(parent.guard))

    def _comprehension_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _comprehension feature detection_."""
        if type(parent) is not ast.comprehension:
            return False
        return any(
            item is target for condition in parent.ifs for item in ast.walk(condition)
        )

    def _callable_feature(self, node: ast.Call) -> bool:
        """Responsibilities: _callable feature detection_."""
        target: ast.AST = node
        parent = self.parents.get(id(node))
        while parent is not None:
            if self._condition_feature(parent, target):
                return True
            if self._match_feature(parent, target):
                return True
            if self._comprehension_feature(parent, target):
                return True
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                return False
            target = parent
            parent = self.parents.get(id(parent))
        return False

    def _rule_name(self, name: str) -> str:
        """Responsibilities: _reflection rule mapping_."""
        if name in self.python_only_reflections:
            return f"python-{name}"
        return name

    def __init__(self) -> None:
        """Responsibilities: _reflection classification setup_."""
        self.reflection_names: PythonBuiltinReflectionNames = (
            PythonBuiltinReflectionNames()
        )
        self.python_only_reflections: set[str] = {"isinstance", "callable"}
        self.parents: dict[int, ast.AST] = {}

    def configure(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _reflection alias indexing_."""
        self.reflection_names.configure(tree)
        parents = {
            id(child): node
            for node in node_index.nodes(tree)
            for child in ast.iter_child_nodes(node)
        }
        self.parents.clear()
        self.parents.update(parents)

    def issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reflection violation collection_."""
        if type(node) is not ast.Call:
            return []
        reflection_name = self.reflection_names.name(node.func)
        if not reflection_name:
            return []
        if reflection_name == "callable":
            if not self._callable_feature(node):
                return []
        return [{"line": node.lineno - 1, "kind": self._rule_name(reflection_name)}]
