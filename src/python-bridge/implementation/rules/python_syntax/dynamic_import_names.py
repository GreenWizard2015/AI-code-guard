from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_DYNAMIC_IMPORT_FUNCTION,
    PYTHON_FUNCTION_KIND,
    PYTHON_GETATTR_FUNCTION,
    PYTHON_IMPORT_MODULE_FUNCTION,
    PYTHON_IMPORTLIB_MODULE,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportReferenceResolverContract,
)


@dataclass(frozen=True)
class PythonDynamicImportNamesOptions:
    """Responsibilities: _import aliases_, _dynamic module names_."""

    container_aliases: PythonContainerAliasesContract
    references: PythonDynamicImportReferenceResolverContract
    module_aliases: dict[str, str]
    builtin_module_aliases: set[str]
    function_aliases: dict[str, str]


class PythonDynamicImportNames:
    """Responsibilities: _module import aliases_, _function import aliases_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported local name_."""
        if imported.asname is not None:
            return imported.asname
        name_parts = imported.name.split(".")
        return name_parts[0]

    def _configure_module_import(self, node: ast.Import) -> None:
        """Responsibilities: _configuration dynamic import modules_."""
        for imported in node.names:
            if imported.name == PYTHON_IMPORTLIB_MODULE:
                self._module_aliases.update({self._local_name(imported): PYTHON_IMPORTLIB_MODULE})
            if imported.name == PYTHON_BUILTINS_MODULE:
                self._builtin_module_aliases.add(self._local_name(imported))

    def _configure_function_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration dynamic import functions_."""
        if node.module == PYTHON_IMPORTLIB_MODULE:
            for imported in node.names:
                if imported.name == PYTHON_IMPORT_MODULE_FUNCTION:
                    self._function_aliases.update({self._local_name(imported): PYTHON_IMPORT_MODULE_FUNCTION})
        if node.module == PYTHON_BUILTINS_MODULE:
            for imported in node.names:
                if imported.name in {
                    PYTHON_DYNAMIC_IMPORT_FUNCTION,
                    PYTHON_GETATTR_FUNCTION,
                }:
                    self._function_aliases.update({self._local_name(imported): imported.name})

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration assigned dynamic aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value, node)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value, node)

    def _configure_container_target(self, target: ast.AST) -> None:
        """Responsibilities: _configuration container alias target_."""
        if type(target) is not ast.Name:
            return
        self._module_aliases.pop(target.id, None)
        self._function_aliases.pop(target.id, None)

    def _assignment_alias_values(
        self,
        targets: list[ast.expr],
        value: ast.AST,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _assigned import alias extraction_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self._assignment_aliases.target_values(
                    target,
                    value,
                    references_only=False,
                ),
            )
            self._configure_container_target(target)
        return target_values

    def _record_assignment_aliases(self, target_values: dict[str, ast.AST]) -> None:
        """Responsibilities: _dynamic alias reference recording_."""
        for target_name, source in target_values.items():
            reference = self._references.reference(source)
            if reference.kind_value() == "module":
                self._module_aliases.update({target_name: reference.name_value()})
            if reference.kind_value() == PYTHON_FUNCTION_KIND:
                self._function_aliases.update({target_name: reference.name_value()})

    def _configure_assignment_targets(
        self,
        targets: list[ast.expr],
        value: ast.AST,
        assignment: ast.AST,
    ) -> None:
        """Responsibilities: _configuration dynamic alias targets_."""
        target_values = self._assignment_alias_values(targets, value)
        self._container_aliases.observe(assignment)
        self._record_assignment_aliases(target_values)

    def __init__(
        self,
        options: PythonDynamicImportNamesOptions,
    ) -> None:
        """Responsibilities: _initialization dynamic import aliases_."""
        self._module_aliases: dict[str, str] = options.module_aliases
        self._builtin_module_aliases: set[str] = options.builtin_module_aliases
        self._container_aliases: PythonContainerAliasesContract = options.container_aliases
        self._function_aliases: dict[str, str] = options.function_aliases
        self._references: PythonDynamicImportReferenceResolverContract = options.references
        self._assignment_aliases: PythonReferenceAliasesContract = PythonReferenceAliases(PythonReferenceAliasState())

    def configure(self) -> None:
        """Responsibilities: _configuration dynamic import aliases_."""
        self._module_aliases.clear()
        self._builtin_module_aliases.clear()
        self._container_aliases.clear()
        self._function_aliases.clear()
        self._function_aliases.update({PYTHON_DYNAMIC_IMPORT_FUNCTION: PYTHON_DYNAMIC_IMPORT_FUNCTION})
        self._function_aliases.update({PYTHON_GETATTR_FUNCTION: PYTHON_GETATTR_FUNCTION})

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation dynamic import aliases_."""
        if type(node) is ast.Import:
            self._configure_module_import(node)
        if type(node) is ast.ImportFrom:
            self._configure_function_import(node)
        self._configure_assignment(node)

    def matches(self, function: ast.AST) -> bool:
        """Responsibilities: _classification dynamic import function_."""
        reference = self._references.reference(function)
        if reference.kind_value() != PYTHON_FUNCTION_KIND:
            return False
        return reference.name_value() in {
            PYTHON_IMPORT_MODULE_FUNCTION,
            PYTHON_DYNAMIC_IMPORT_FUNCTION,
        }
