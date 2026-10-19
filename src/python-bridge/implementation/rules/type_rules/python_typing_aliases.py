from __future__ import annotations

import ast

from implementation.references.aliases.protocols import (
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
                self.optional_names.add(local_name)
            if imported.name == PYTHON_UNION_NAME:
                self.union_names.add(local_name)

    def _configure_assignment_targets(
        self,
        targets: list[ast.AST],
        value: ast.AST,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _configuration assigned typing aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
            )
        for target, source in target_values.items():
            name = self.expression_name(source, container_aliases)
            self.optional_names.discard(target)
            self.union_names.discard(target)
            if name == PYTHON_OPTIONAL_NAME:
                self.optional_names.add(target)
            if name == PYTHON_UNION_NAME:
                self.union_names.add(target)

    def _subscript_expression_name(
        self, value: ast.Subscript, container_aliases: PythonContainerAliasesContract
    ) -> str:
        """Responsibilities: _typing alias subscript name_."""
        resolved = container_aliases.container_values.container_value(value)
        if not resolved.found():
            return ""
        return self.expression_name(resolved.expression_node(), container_aliases)

    def _named_expression_name(self, value: ast.AST) -> str:
        """Responsibilities: _typing alias named expression_."""
        if type(value) is ast.Name:
            if value.id in self.optional_names:
                return PYTHON_OPTIONAL_NAME
            if value.id in self.union_names:
                return PYTHON_UNION_NAME
        if type(value) is ast.Attribute:
            if value.attr in {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME}:
                return value.attr
        return ""

    def __init__(self, assignment_aliases: PythonReferenceAliasesContract) -> None:
        """Responsibilities: _configuration typing names_."""
        self.optional_names: set[str] = {PYTHON_OPTIONAL_NAME}
        self.union_names: set[str] = {PYTHON_UNION_NAME}
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases

    def expression_name(
        self, value: ast.AST, container_aliases: PythonContainerAliasesContract
    ) -> str:
        """Responsibilities: _resolution typing alias expression_."""
        if type(value) is ast.Subscript:
            return self._subscript_expression_name(value, container_aliases)
        return self._named_expression_name(value)

    def observe(
        self, node: ast.AST, container_aliases: PythonContainerAliasesContract
    ) -> None:
        """Responsibilities: _observation typing aliases_."""
        container_aliases.observe(node)
        self._import_aliases(node)
        if type(node) is ast.Assign:
            self._configure_assignment_targets(
                node.targets, node.value, container_aliases
            )
            return
        if type(node) is ast.AnnAssign and node.value is not None:
            self._configure_assignment_targets(
                [node.target], node.value, container_aliases
            )

    def matches_optional(self, name: str) -> bool:
        """Responsibilities: _identification optional name_."""
        return name in self.optional_names

    def matches_union(self, name: str) -> bool:
        """Responsibilities: _identification union name_."""
        return name in self.union_names
