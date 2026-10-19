from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.protocols import PythonDynamicTypeReferencesContract
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerLookupContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_BUILTINS_MODULE


@dataclass
class PythonDynamicTypeRulesOptions:
    """Responsibilities: _dynamic type names_, _container and reference resolution_."""

    type_names: set[str]
    module_names: set[str]
    references: PythonDynamicTypeReferencesContract
    container_aliases: PythonContainerAliasesContract
    lookup_values: PythonContainerValuesContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonDynamicTypeRules:
    """Responsibilities: _type alias tracking_, _dynamic type classification_."""

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
            if node.module == PYTHON_BUILTINS_MODULE:
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
            if imported.name != PYTHON_BUILTINS_MODULE:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.module_names.add(local_name)

    def _issue_values(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _dynamic type issue values_."""
        if type(node) in (ast.With, ast.AsyncWith):
            return [item.context_expr for item in node.items]
        if type(node) is ast.ClassDef:
            values = list(node.bases)
            values.extend(keyword.value for keyword in node.keywords)
            return values
        value = self._statement_value(node)
        if value.found():
            return [value.expression_node()]
        if type(node) is ast.Return and node.value is not None:
            return [node.value]
        if type(node) is ast.Raise and node.exc is not None:
            return [node.exc]
        return []

    def _statement_value(self, node: ast.AST) -> PythonContainerLookupContract:
        """Responsibilities: _dynamic statement value selection_."""
        if type(node) is ast.Expr:
            return PythonContainerLookup(True, node.value)
        if type(node) is ast.Assign:
            return PythonContainerLookup(True, node.value)
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                return PythonContainerLookup(True, node.value)
        if type(node) in (ast.With, ast.AsyncWith):
            if node.items:
                return PythonContainerLookup(True, node.items[0].context_expr)
        return self._control_value(node)

    def _control_value(self, node: ast.AST) -> PythonContainerLookupContract:
        """Responsibilities: _control expression value selection_."""
        if type(node) in (ast.If, ast.While, ast.Assert):
            return PythonContainerLookup(True, node.test)
        if type(node) in (ast.For, ast.AsyncFor):
            return PythonContainerLookup(True, node.iter)
        return PythonContainerLookup(False, ast.Constant(value=None))

    def __init__(self, options: PythonDynamicTypeRulesOptions) -> None:
        """Responsibilities: _configuration dynamic type names_."""
        self.type_names: set[str] = options.type_names
        self.module_names: set[str] = options.module_names
        self.assignment_aliases: PythonReferenceAliasesContract = (
            options.assignment_aliases
        )
        self.container_aliases: PythonContainerAliasesContract = (
            options.container_aliases
        )
        self.lookup_values: PythonContainerValuesContract = options.lookup_values
        self.references: PythonDynamicTypeReferencesContract = options.references

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration dynamic type aliases_."""
        self.type_names.clear()
        self.type_names.add("type")
        self.module_names.clear()
        self.module_names.add(PYTHON_BUILTINS_MODULE)
        self.container_aliases.clear()
        self.container_aliases._configure_scope_tree(tree)
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self._observe(node)

    def issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting dynamic type usage_."""
        self._observe(node)
        issues: list[JsonObject] = []
        for value in self._issue_values(node):
            if self.references.type_call_present(value):
                issues.append({"line": node.lineno - 1, "kind": "dynamic-type"})
        return issues
