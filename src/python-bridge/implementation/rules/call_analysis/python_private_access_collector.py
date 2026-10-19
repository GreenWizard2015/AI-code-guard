from __future__ import annotations

import ast
from typing import Any

from implementation.protocols import (
    PythonPrivateAccessClassifierContract,
    PythonPrivateAccessOptionsContract,
)
from implementation.types import JsonObject
from implementation.rules.call_analysis.python_private_access_classifier import (
    PythonPrivateAccessClassifier,
)
from implementation.rules.constants import (
    PYTHON_CLASS_NAME,
    PYTHON_CONTAINER_ALIASES_KEY,
    PYTHON_SELF_NAME,
    PYTHON_TREE_KEY,
    PYTHON_NODE_INDEX_KEY,
)


class PythonPrivateAccessCollector:
    """Responsibilities: _private member indexing_, _member access collection_."""

    def _member_name(self, member: ast.AST) -> str:
        """Responsibilities: _resolution attribute member name_."""
        if type(member) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return member.name
        is_annotated_name = type(member) is ast.AnnAssign
        if is_annotated_name:
            is_annotated_name = type(member.target) is ast.Name
        if is_annotated_name:
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
        option_data = self.options.data()
        for member in node.body:
            name: Any = self._member_name(member)
            private_name = self._private_member_name(name)
            if not private_name:
                continue
            result.add(private_name)
        node_index = option_data[PYTHON_NODE_INDEX_KEY]
        for nested in node_index.nodes(node):
            name: Any = self._stored_member(nested)
            if name:
                result.add(name)
        return result

    def _access_lines(self, nodes: list[ast.AST], members: set[str]) -> set[int]:
        """Responsibilities: _private access lines_."""
        lines: set[int] = set()
        for node in nodes:
            lines.update(self.classifier.attribute_lines(node, members))
            if type(node) is ast.Attribute:
                continue
            if self.classifier.private_access(node, members):
                lines.add(node.lineno - 1)
        return lines

    def __init__(self, options: PythonPrivateAccessOptionsContract) -> None:
        """Responsibilities: _initialization private access collector_."""
        self.options: PythonPrivateAccessOptionsContract = options
        self.classifier: PythonPrivateAccessClassifierContract = (
            PythonPrivateAccessClassifier(options)
        )

    def member_names(self) -> set[str]:
        """Responsibilities: _collection private member names_."""
        result: set[str] = set()
        option_data = self.options.data()
        node_index = option_data[PYTHON_NODE_INDEX_KEY]
        tree = option_data[PYTHON_TREE_KEY]
        for node in node_index.nodes(tree):
            if type(node) is ast.ClassDef:
                result.update(self._class_members(node))
        return result

    def accesses(self, members: set[str]) -> list[JsonObject]:
        """Responsibilities: _collection private access diagnostics_."""
        option_data = self.options.data()
        tree = option_data[PYTHON_TREE_KEY]
        container_aliases = option_data[PYTHON_CONTAINER_ALIASES_KEY]
        node_index = option_data[PYTHON_NODE_INDEX_KEY]
        container_aliases._configure_scope_tree(tree)
        nodes = node_index.nodes(tree)
        container_aliases.observe_all(nodes, tree)
        lines = self._access_lines(nodes, members)
        return [{"line": line} for line in sorted(lines)]
