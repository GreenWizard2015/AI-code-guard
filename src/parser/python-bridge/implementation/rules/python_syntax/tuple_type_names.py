from __future__ import annotations


import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol


class PythonTupleTypeNames:
    """Responsibilities: _tuple type alias resolution_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported tuple name_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name

    def _configure_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported tuple aliases_."""
        if node.module not in ("typing", "typing_extensions", "builtins"):
            return
        for imported in node.names:
            if imported.name not in {"Tuple", "tuple"}:
                continue
            self.aliases.add(self._local_name(imported))

    def _expression_matches(self, value: ast.AST) -> bool:
        """Responsibilities: _classification tuple expression_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if not resolved.found():
                return False
            return self._expression_matches(resolved.expression_node())
        if type(value) is ast.Name:
            return value.id in self.aliases or value.id in {"Tuple", "tuple"}
        if type(value) is ast.Attribute:
            return value.attr == "Tuple"
        return False

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration assigned tuple aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign or node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _configuration tuple alias targets_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
            )
        for target, source in target_values.items():
            matches = self._expression_matches(source)
            self.aliases.discard(target)
            if matches:
                self.aliases.add(target)

    def __init__(self) -> None:
        """Responsibilities: _initialization tuple alias state_."""
        self.aliases: set[str] = {"Tuple", "tuple"}
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration tuple import aliases_."""
        self.container_aliases.clear()
        if type(tree) is ast.Module:
            for node in tree.body:
                self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation tuple aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom:
            self._configure_import(node)
        self._configure_assignment(node)

    def annotation(self, value: ast.AST) -> bool:
        """Responsibilities: _classification tuple annotation_."""
        if type(value) is not ast.Subscript:
            return False
        return self._expression_matches(value.value)
