from __future__ import annotations

import ast

from implementation.rules.call_analysis.private_access_protocols import (
    PythonPrivateAccessOptionsContract,
)
from implementation.rules.call_analysis.reflection.python_private_access_classifier import (
    PythonPrivateAccessClassifier,
)
from implementation.rules.constants import (
    PYTHON_CLASS_NAME,
    PYTHON_SELF_NAME,
)
from implementation.types import JsonObject


class PythonPrivateAccessCollector:
    """Responsibilities: _private member indexing_, _member access collection_."""

    def _member_name(self, member: ast.AST) -> str:
        """Responsibilities: _resolution attribute member name_."""
        if type(member) is ast.FunctionDef:
            return member.name
        if type(member) is ast.AsyncFunctionDef:
            return member.name
        if type(member) is not ast.AnnAssign:
            return ""
        if type(member.target) is ast.Name:
            return member.target.id
        return ""

    def _stored_member(self, node: ast.AST) -> str:
        """Responsibilities: _resolution member name storage_."""
        if type(node) is not ast.Attribute:
            return ""
        if type(node.ctx) is not ast.Store:
            return ""
        if type(node.value) is not ast.Name:
            return ""
        if node.value.id not in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}:
            return ""
        if node.attr.startswith("__"):
            if node.attr.endswith("__"):
                return ""
        if node.attr.startswith("_"):
            return node.attr
        return ""

    def _private_member_name(self, name: str) -> str:
        """Responsibilities: _private member name filtering_."""
        if not name:
            return ""
        if not name.startswith("_"):
            return ""
        if name.startswith("__"):
            if name.endswith("__"):
                return ""
        return name

    def _class_members(self, node: ast.ClassDef) -> set[str]:
        """Responsibilities: _collection private members declared_."""
        result: set[str] = set()
        for member in node.body:
            member_name = self._member_name(member)
            private_name = self._private_member_name(member_name)
            if not private_name:
                continue
            result.add(private_name)
        node_index = self._options.node_index
        for nested in node_index.nodes(node):
            stored_name = self._stored_member(nested)
            if stored_name:
                result.add(stored_name)
        return result

    def _access_lines(self, nodes: list[ast.AST], members: set[str]) -> set[int]:
        """Responsibilities: _private access lines_."""
        lines: set[int] = set()
        classifier = PythonPrivateAccessClassifier(self._options, members)
        for node in nodes:
            lines.update(classifier.attribute_lines(node))
            if type(node) is ast.Attribute:
                continue
            match node:
                case ast.expr(lineno=line) as access_expression if classifier.private_access(access_expression):
                    lines.add(line - 1)
                case _:
                    continue
        return lines

    def __init__(self, options: PythonPrivateAccessOptionsContract) -> None:
        """Responsibilities: _initialization private access collector_."""
        self._options: PythonPrivateAccessOptionsContract = options

    def member_names(self) -> set[str]:
        """Responsibilities: _collection private member names_."""
        result: set[str] = set()
        node_index = self._options.node_index
        tree = self._options.tree
        for node in node_index.nodes(tree):
            if type(node) is ast.ClassDef:
                result.update(self._class_members(node))
        return result

    def accesses(self, members: set[str]) -> list[JsonObject]:
        """Responsibilities: _collection private access diagnostics_."""
        tree = self._options.tree
        container_aliases = self._options.container_aliases
        node_index = self._options.node_index
        nodes = node_index.nodes(tree)
        container_aliases.observe_all(nodes, tree)
        lines = self._access_lines(nodes, members)
        return [{"line": line} for line in sorted(lines)]
