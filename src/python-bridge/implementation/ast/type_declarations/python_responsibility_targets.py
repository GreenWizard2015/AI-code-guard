from __future__ import annotations

import ast
from collections.abc import Iterable
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_FUNCTION_KIND, PYTHON_PROTOCOL_NAME
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonResponsibilityTargets:
    """Responsibilities: _responsibility target collection_, _field record classification_."""

    _targets: list[JsonObject]

    def _documentation(self, documented_node: ast.AST) -> str:
        """Responsibilities: _Python documentation access_."""
        match documented_node:
            case ast.Module() | ast.ClassDef() | ast.FunctionDef() | ast.AsyncFunctionDef():
                pass
            case _:
                return ""
        value = ast.get_docstring(documented_node, clean=False)
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
        responsibility_node: ast.AST,
        documentation: str,
    ) -> JsonObject:
        """Responsibilities: _Python responsibility targets collection_."""
        return {
            "kind": kind,
            "name": name,
            "line": cast(PythonASTLocatedNode, responsibility_node).lineno - 1,
            "documentation": documentation,
        }

    def _class_method_target(self, callable_candidate: ast.AST) -> bool:
        """Responsibilities: _class method target collection_."""
        match callable_candidate:
            case ast.FunctionDef() | ast.AsyncFunctionDef() as callable_node:
                pass
            case _:
                return False
        parents = self._node_index.parents(callable_node)
        if not parents or type(parents[0]) is not ast.ClassDef:
            return False
        parent = parents[0]
        if not self._is_protocol(parent):
            self._targets.append(
                self._target(
                    "method",
                    callable_node.name,
                    callable_node,
                    self._documentation(callable_node),
                ),
            )
        return True

    def _append_callable_target(self, callable_candidate: ast.AST) -> None:
        """Responsibilities: _aggregation Python callable responsibility_."""
        match callable_candidate:
            case ast.FunctionDef() | ast.AsyncFunctionDef() as callable_node:
                pass
            case _:
                return
        if self._class_method_target(callable_node):
            return
        self._targets.append(
            self._target(
                PYTHON_FUNCTION_KIND,
                callable_node.name,
                callable_node,
                self._documentation(callable_node),
            ),
        )

    def _append_node_target(self, visited_node: ast.AST) -> None:
        """Responsibilities: _Python responsibility targets collection_."""
        if type(visited_node) is ast.ClassDef:
            kind = "interface" if self._is_protocol(visited_node) else "class"
            if kind == "class":
                if self._is_field_record(visited_node):
                    kind = "record"
            self._targets.append(
                self._target(
                    kind,
                    visited_node.name,
                    visited_node,
                    self._documentation(visited_node),
                ),
            )
            return
        if type(visited_node) is ast.FunctionDef or type(visited_node) is ast.AsyncFunctionDef:
            self._append_callable_target(visited_node)

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization Python responsibility target_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._targets = []

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        return self.collect_nodes(self._node_index.nodes(self._tree))

    def collect_nodes(self, nodes: Iterable[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _Python responsibility targets collection_."""
        self._targets.clear()
        for node in nodes:
            self._append_node_target(node)
        return list(self._targets)
