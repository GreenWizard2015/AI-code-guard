from __future__ import annotations

import ast
from collections.abc import Iterable
from typing import Any

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_FUNCTION_KIND, PYTHON_PROTOCOL_NAME


class PythonResponsibilityTargets:
    """Responsibilities: _responsibility target collection_, _field record classification_."""

    def _documentation(self, node: ast.AST) -> str:
        """Responsibilities: _Python documentation access_."""
        value: Any = ast.get_docstring(node, clean=False)
        if value is None:
            return ""
        return value

    def _is_protocol(self, node: ast.ClassDef) -> bool:
        """Responsibilities: _Python declarations classification_."""
        for base in node.bases:
            if type(base) is ast.Name and base.id == PYTHON_PROTOCOL_NAME:
                return True
            if type(base) is ast.Attribute and base.attr == PYTHON_PROTOCOL_NAME:
                return True
        return False

    def _is_field_record(self, node: ast.ClassDef) -> bool:
        """Responsibilities: _field-only class recognition_."""
        body = node.body
        if body and type(body[0]) is ast.Expr and type(body[0].value) is ast.Constant:
            if type(body[0].value.value) is str:
                body = body[1:]
        if not body:
            return False
        return all(type(statement) is ast.AnnAssign for statement in body)

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

    def _append_callable_target(self, node: ast.AST, targets: list[JsonObject]) -> None:
        """Responsibilities: _aggregation Python callable responsibility_."""
        parents = self.node_index.parents(node)
        parent: Any = None
        if parents:
            parent = parents[0]
        if type(parent) is ast.ClassDef:
            if not self._is_protocol(parent):
                targets.append(
                    self._target("method", node.name, node, self._documentation(node))
                )
            return
        targets.append(
            self._target(
                PYTHON_FUNCTION_KIND, node.name, node, self._documentation(node)
            )
        )

    def _append_node_target(self, node: ast.AST, targets: list[JsonObject]) -> None:
        """Responsibilities: _Python responsibility targets collection_."""
        if type(node) is ast.ClassDef:
            kind = "interface" if self._is_protocol(node) else "class"
            if kind == "class":
                if self._is_field_record(node):
                    kind = "record"
            targets.append(
                self._target(kind, node.name, node, self._documentation(node))
            )
            return
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            self._append_callable_target(node, targets)

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexContract
    ) -> None:
        """Responsibilities: _initialization Python responsibility target_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexContract = node_index

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        return self.collect_nodes(self.node_index.nodes(self.tree))

    def collect_nodes(self, nodes: Iterable[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        targets: list[JsonObject] = []
        for node in nodes:
            self._append_node_target(node, targets)
        return targets
