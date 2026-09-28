from __future__ import annotations

import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol


class PythonTypingAliases:
    """Responsibilities: _classification Python typing aliases_."""

    def _import_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _configuration typing import aliases_."""
        if type(node) is not ast.ImportFrom:
            return
        if node.module not in ("typing", "typing_extensions"):
            return
        for imported in node.names:
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            if imported.name == "Optional":
                self.optional_names.add(local_name)
            if imported.name == "Union":
                self.union_names.add(local_name)

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
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
            name = self.expression_name(source)
            self.optional_names.discard(target)
            self.union_names.discard(target)
            if name == "Optional":
                self.optional_names.add(target)
            if name == "Union":
                self.union_names.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration typing assignment aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)

    def __init__(self) -> None:
        """Responsibilities: _configuration typing names_."""
        self.optional_names: set[str] = {"Optional"}
        self.union_names: set[str] = {"Union"}
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )

    def expression_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution typing alias expression_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if resolved.found():
                return self.expression_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in self.optional_names:
                return "Optional"
            if value.id in self.union_names:
                return "Union"
        if type(value) is ast.Attribute:
            if value.attr in {"Optional", "Union"}:
                return value.attr
        return ""

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration typing aliases_."""
        self.container_aliases.clear()
        if type(tree) is ast.Module:
            for node in tree.body:
                self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation typing aliases_."""
        self.container_aliases.observe(node)
        self._import_aliases(node)
        self._configure_assignment(node)

    def matches_optional(self, name: str) -> bool:
        """Responsibilities: _identification optional name_."""
        return name in self.optional_names

    def matches_union(self, name: str) -> bool:
        """Responsibilities: _identification union name_."""
        return name in self.union_names
