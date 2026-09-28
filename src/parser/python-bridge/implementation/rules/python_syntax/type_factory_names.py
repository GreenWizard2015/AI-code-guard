from __future__ import annotations


import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.rules.constants import TYPE_FACTORIES


class PythonTypeFactoryNames:
    """Responsibilities: _dynamic type factory resolution_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported factory name_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name

    def _configure_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported factory aliases_."""
        for imported in node.names:
            if imported.name in self.factory_names:
                self.aliases.add(self._local_name(imported))

    def _expression_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution factory expression name_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if resolved.found():
                return self._expression_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in self.factory_names:
                return value.id
            if value.id in self.aliases:
                return value.id
        if type(value) is ast.Attribute and value.attr in self.factory_names:
            return value.attr
        return ""

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _configuration assigned factory aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(target, value, references_only=False)
            )
        for target, source in target_values.items():
            name = self._expression_name(source)
            self.aliases.discard(target)
            if name:
                self.aliases.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration factory assignment aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign or node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)

    def __init__(self) -> None:
        """Responsibilities: _initialization factory alias state_."""
        self.factory_names: frozenset[str] = TYPE_FACTORIES
        self.aliases: set[str] = set()
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = PythonContainerAliases()

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration factory import aliases_."""
        self.container_aliases.clear()
        if type(tree) is ast.Module:
            for node in tree.body:
                self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation factory aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom:
            self._configure_import(node)
        self._configure_assignment(node)

    def matches(self, value: ast.AST) -> bool:
        """Responsibilities: _classification factory expression_."""
        return bool(self._expression_name(value))
