from __future__ import annotations

import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import (
    PythonContainerAliasesProtocol,
    PythonContainerLookupProtocol,
    PythonContainerValuesProtocol,
)
from implementation.rules.python_syntax.dynamic_type_references import (
    PythonDynamicTypeReferences,
)
from implementation.types import JsonObject


class PythonDynamicTypeRules:
    """Responsibilities: _classification Python dynamic types_."""

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _configuration assigned type aliases_."""
        for target in targets:
            aliases = self.assignment_aliases.target_values(
                target, value, references_only=False
            )
            for target_name, target_value in aliases.items():
                is_type_alias = bool(self.references.reference_name(target_value))
                is_module_alias = bool(self.references.module_reference(target_value))
                self.type_names.discard(target_name)
                self.module_names.discard(target_name)
                if is_type_alias:
                    self.type_names.add(target_name)
                if is_module_alias:
                    self.module_names.add(target_name)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration type alias assignments_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                self._configure_assignment_targets([node.target], node.value)

    def _observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation dynamic type aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.Import:
            self._configure_module_alias(node)
        if type(node) is ast.ImportFrom:
            if node.module == "builtins":
                for imported in node.names:
                    self._configure_type_alias(imported)
        self._configure_assignment(node)

    def _configure_type_alias(self, imported: ast.alias) -> None:
        """Responsibilities: _configuration imported type alias_."""
        if imported.name != "type":
            return
        local_name = imported.name
        if imported.asname is not None:
            local_name = imported.asname
        self.type_names.add(local_name)

    def _configure_module_alias(self, node: ast.Import) -> None:
        """Responsibilities: _configuration builtins module alias_."""
        for imported in node.names:
            if imported.name != "builtins":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.module_names.add(local_name)

    def _issue_value(self, node: ast.AST) -> PythonContainerLookupProtocol:
        """Responsibilities: _dynamic type issue value_."""
        if type(node) is ast.Assign:
            return self.lookup_values.container_result(True, node.value)
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                return self.lookup_values.container_result(True, node.value)
        if type(node) is ast.Return:
            if node.value is not None:
                return self.lookup_values.container_result(True, node.value)
        if type(node) is ast.Raise:
            if node.exc is not None:
                return self.lookup_values.container_result(True, node.exc)
        return self.lookup_values.container_result(False, ast.Constant(value=None))

    def __init__(self) -> None:
        """Responsibilities: _configuration dynamic type names_."""
        self.type_names: set[str] = {"type"}
        self.module_names: set[str] = {"builtins"}
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        container_aliases = PythonContainerAliases()
        self.container_aliases: PythonContainerAliasesProtocol = container_aliases
        self.lookup_values: PythonContainerValuesProtocol = container_aliases.values
        self.references: PythonDynamicTypeReferences = PythonDynamicTypeReferences(
            self.type_names,
            self.module_names,
            self.container_aliases,
            self.lookup_values,
        )

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration dynamic type aliases_."""
        self.type_names.clear()
        self.type_names.add("type")
        self.module_names.clear()
        self.module_names.add("builtins")
        self.container_aliases.clear()
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self._observe(node)

    def issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting dynamic type usage_."""
        self._observe(node)
        value = self._issue_value(node)
        if not value.found():
            return []
        if not self.references.type_call_present(value.expression_node()):
            return []
        return [{"line": node.lineno - 1, "kind": "dynamic-type"}]
