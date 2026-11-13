from __future__ import annotations

import ast
from collections.abc import Sequence
from dataclasses import dataclass

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerAliasStateContract,
    PythonContainerValuesContract,
    PythonDynamicTypeReferencesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import PYTHON_BUILTINS_MODULE
from implementation.rules.python_syntax.python_dynamic_type_statement_values import (
    PythonDynamicTypeStatementValues,
)
from implementation.types import JsonObject


@dataclass
class PythonDynamicTypeRulesOptions:
    """Responsibilities: _dynamic type names_, _container and reference resolution_."""

    type_names: set[str]
    module_names: set[str]
    references: PythonDynamicTypeReferencesContract
    container_aliases: PythonContainerAliasesContract
    container_state: PythonContainerAliasStateContract
    lookup_values: PythonContainerValuesContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonDynamicTypeRules:
    """Responsibilities: _type alias tracking_, _dynamic type classification_."""

    def _configure_assignment_targets(
        self,
        targets: Sequence[ast.expr],
        value: ast.AST,
    ) -> None:
        """Responsibilities: _configuration assigned type aliases_."""
        for target in targets:
            aliases = self._options.assignment_aliases.target_values(
                target,
                value,
                references_only=False,
            )
            for target_name, target_value in aliases.items():
                self._options.type_names.discard(target_name)
                self._options.module_names.discard(target_name)
                if self._options.references.reference_name(target_value):
                    self._options.type_names.add(target_name)
                if self._options.references.module_reference(target_value):
                    self._options.module_names.add(target_name)

    def _configure_assignment(self, assignment: ast.AST) -> None:
        """Responsibilities: _configuration type alias assignments_."""
        if type(assignment) is ast.Assign:
            self._configure_assignment_targets(assignment.targets, assignment.value)
            return
        if type(assignment) is ast.AnnAssign:
            if assignment.value is not None:
                self._configure_assignment_targets(
                    [assignment.target],
                    assignment.value,
                )

    def _observe(self, observed_node: ast.AST) -> None:
        """Responsibilities: _observation dynamic type aliases_."""
        self._options.container_aliases.observe(observed_node)
        if type(observed_node) is ast.Import:
            self._configure_module_alias(observed_node)
        if type(observed_node) is ast.ImportFrom:
            if observed_node.module == PYTHON_BUILTINS_MODULE:
                for imported in observed_node.names:
                    self._configure_type_alias(imported)
        self._configure_assignment(observed_node)

    def _configure_type_alias(self, imported: ast.alias) -> None:
        """Responsibilities: _configuration imported type alias_."""
        if imported.name != "type":
            return
        local_name = imported.name
        if imported.asname is not None:
            local_name = imported.asname
        self._options.type_names.add(local_name)

    def _configure_module_alias(self, imported_module: ast.Import) -> None:
        """Responsibilities: _configuration builtins module alias_."""
        for imported in imported_module.names:
            if imported.name != PYTHON_BUILTINS_MODULE:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._options.module_names.add(local_name)

    def __init__(self, options: PythonDynamicTypeRulesOptions) -> None:
        """Responsibilities: _configuration dynamic type names_."""
        self._options: PythonDynamicTypeRulesOptions = options

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration dynamic type aliases_."""
        self._options.type_names.clear()
        self._options.type_names.add("type")
        self._options.module_names.clear()
        self._options.module_names.add(PYTHON_BUILTINS_MODULE)
        self._options.container_aliases.clear()
        self._options.container_state.configure_scope_tree(tree)
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self._observe(node)

    def issues(self, statement: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting dynamic type usage_."""
        self._observe(statement)
        statement_values = PythonDynamicTypeStatementValues(statement)
        match statement:
            case ast.stmt(lineno=line):
                return [
                    {"line": line - 1, "kind": "dynamic-type"}
                    for value in statement_values.issue_values()
                    if self._options.references.type_call_present(value)
                ]
            case _:
                return []
