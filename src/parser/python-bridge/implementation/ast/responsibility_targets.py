from __future__ import annotations

import ast
from collections.abc import Iterable
from typing import Any

from implementation.types import JsonObject


class PythonResponsibilityTargets:
    """Responsibilities: _collection Python responsibility targets_."""

    def _parents(self) -> dict[ast.AST, ast.AST]:
        """Responsibilities: _Python responsibility targets collection_."""
        parents: dict[ast.AST, ast.AST] = {}
        for node in ast.walk(self.tree):
            for child in ast.iter_child_nodes(node):
                parents[child] = node
        return parents

    def _documentation(self, node: ast.AST) -> str:
        """Responsibilities: _Python documentation access_."""
        value: Any = ast.get_docstring(node, clean=False)
        if value is None:
            return ""
        return value

    def _is_protocol(self, node: ast.ClassDef) -> bool:
        """Responsibilities: _Python declarations classification_."""
        for base in node.bases:
            if type(base) is ast.Name and base.id == "Protocol":
                return True
            if type(base) is ast.Attribute and base.attr == "Protocol":
                return True
        return False

    def _target(
        self,
        kind: str,
        name: str,
        node: ast.AST,
        documentation: str,
    ) -> JsonObject:
        """Responsibilities: _Python responsibility targets collection_."""
        return {
            "kind": kind,
            "name": name,
            "line": node.lineno - 1,
            "documentation": documentation,
        }

    def _append_callable_target(
        self,
        node: ast.AST,
        parents: dict[ast.AST, ast.AST],
        targets: list[JsonObject],
    ) -> None:
        """Responsibilities: _aggregation Python callable responsibility_."""
        parent = parents.get(node)
        if type(parent) is ast.ClassDef:
            if not self._is_protocol(parent):
                targets.append(
                    self._target("method", node.name, node, self._documentation(node))
                )
            return
        targets.append(
            self._target("function", node.name, node, self._documentation(node))
        )

    def _append_node_target(
        self,
        node: ast.AST,
        parents: dict[ast.AST, ast.AST],
        targets: list[JsonObject],
    ) -> None:
        """Responsibilities: _Python responsibility targets collection_."""
        if type(node) is ast.ClassDef:
            kind = "interface" if self._is_protocol(node) else "class"
            targets.append(
                self._target(kind, node.name, node, self._documentation(node))
            )
            return
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            self._append_callable_target(node, parents, targets)
            return
        return

    def __init__(self, tree: ast.Module) -> None:
        """Responsibilities: _initialization Python responsibility target_."""
        self.tree: ast.Module = tree

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        return self.collect_nodes(ast.walk(self.tree))

    def collect_nodes(self, nodes: Iterable[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        parents = self._parents()
        targets: list[JsonObject] = []
        for node in nodes:
            self._append_node_target(node, parents, targets)
        return targets
