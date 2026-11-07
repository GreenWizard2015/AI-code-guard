from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_OPTIONAL_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
    PYTHON_UNION_NAME,
)


class PythonTypingAliases:
    """Responsibilities: _typing import alias tracking_, _optional union name resolution_."""

    def _import_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _configuration typing import aliases_."""
        if type(node) is not ast.ImportFrom:
            return
        if node.module not in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
            return
        for imported in node.names:
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            if imported.name == PYTHON_OPTIONAL_NAME:
                self._optional_names.add(local_name)
            if imported.name == PYTHON_UNION_NAME:
                self._union_names.add(local_name)

    def _configure_assignment_targets(
        self,
        targets: list[ast.expr],
        assigned_value: ast.AST,
    ) -> None:
        """Responsibilities: _configuration assigned typing aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self._assignment_aliases.target_values(
                    target,
                    assigned_value,
                    references_only=False,
                ),
            )
        for target_name, source in target_values.items():
            name = self.expression_name(source)
            self._optional_names.discard(target_name)
            self._union_names.discard(target_name)
            if name == PYTHON_OPTIONAL_NAME:
                self._optional_names.add(target_name)
            if name == PYTHON_UNION_NAME:
                self._union_names.add(target_name)

    def _subscript_expression_name(self, subscript: ast.Subscript) -> str:
        """Responsibilities: _typing alias subscript name_."""
        resolved = self._container_aliases.container_values().container_value(subscript)
        if not resolved.found():
            return ""
        return self.expression_name(resolved.expression_node())

    def _named_expression_name(self, name_expression: ast.AST) -> str:
        """Responsibilities: _typing alias named expression_."""
        if type(name_expression) is ast.Name:
            if name_expression.id in self._optional_names:
                return PYTHON_OPTIONAL_NAME
            if name_expression.id in self._union_names:
                return PYTHON_UNION_NAME
        if type(name_expression) is ast.Attribute:
            if name_expression.attr in {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME}:
                return name_expression.attr
        return ""

    def __init__(
        self,
        assignment_aliases: PythonReferenceAliasesContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _configuration typing names_."""
        self._optional_names: set[str] = {PYTHON_OPTIONAL_NAME}
        self._union_names: set[str] = {PYTHON_UNION_NAME}
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._container_aliases: PythonContainerAliasesContract = container_aliases

    def expression_name(self, expression: ast.AST) -> str:
        """Responsibilities: _resolution typing alias expression_."""
        if type(expression) is ast.Subscript:
            return self._subscript_expression_name(expression)
        return self._named_expression_name(expression)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation typing aliases_."""
        self._container_aliases.observe(node)
        self._import_aliases(node)
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign and node.value is not None:
            self._configure_assignment_targets([node.target], node.value)

    def matches_optional(self, name: str) -> bool:
        """Responsibilities: _identification optional name_."""
        return name in self._optional_names

    def matches_union(self, name: str) -> bool:
        """Responsibilities: _identification union name_."""
        return name in self._union_names
