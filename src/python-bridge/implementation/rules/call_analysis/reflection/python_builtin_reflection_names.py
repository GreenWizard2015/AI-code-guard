from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    ALL_REFLECTION_CALLS,
    PYTHON_BUILTINS_MODULE,
    REFLECTION_CALLS,
)

AstNodeList = list[ast.AST]


class PythonBuiltinReflectionNames:
    """Responsibilities: _reflection names_, _builtin names_."""

    def _configure_imported_functions(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported reflection functions_."""
        if node.module != PYTHON_BUILTINS_MODULE:
            return
        for imported in node.names:
            if imported.name not in ALL_REFLECTION_CALLS:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._aliases.update({local_name: imported.name})

    def _configure_imported_modules(self, node: ast.Import) -> None:
        """Responsibilities: _configuration imported builtin modules_."""
        for imported in node.names:
            if imported.name != PYTHON_BUILTINS_MODULE:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._module_names.add(local_name)

    def _builtin_name(self, value: ast.AST) -> str:
        """Responsibilities: _builtin reflection identity_."""
        if type(value) is ast.Subscript:
            resolved = self._container_aliases.container_values().container_value(value)
            if resolved.found():
                return self._builtin_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in REFLECTION_CALLS:
                return value.id
            return ""
        if type(value) is not ast.Attribute:
            return ""
        return self._builtin_attribute_name(value)

    def _builtin_attribute_name(self, value: ast.Attribute) -> str:
        """Responsibilities: _builtin attribute identity_."""
        target = value.value
        if type(target) is not ast.Name:
            return ""
        if target.id in self._module_names:
            if value.attr in REFLECTION_CALLS:
                return value.attr
        return ""

    def _assignment_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _reflection assignment targets_."""
        if type(node) is ast.Assign:
            target_values: dict[str, ast.AST] = {}
            for target in node.targets:
                target_values.update(
                    self._reference_aliases.target_values(
                        target,
                        node.value,
                        references_only=False,
                    ),
                )
            return target_values
        if type(node) is ast.AnnAssign and node.value is not None:
            return self._reference_aliases.target_values(
                node.target,
                node.value,
                references_only=False,
            )
        return {}

    def _configure_imports(self, nodes: AstNodeList) -> None:
        """Responsibilities: _reflection import registration_."""
        for node in nodes:
            if type(node) is ast.ImportFrom:
                self._configure_imported_functions(node)
            if type(node) is ast.Import:
                self._configure_imported_modules(node)
            self._container_aliases.observe(node)

    def _reset(self) -> None:
        """Responsibilities: _reflection state reset_."""
        self._aliases.clear()
        self._module_names.clear()
        self._module_names.add(PYTHON_BUILTINS_MODULE)
        self._container_aliases.clear()

    def _resolve_identity(self, function: ast.AST, names: frozenset[str]) -> str:
        """Responsibilities: _reflection callable identity resolution_."""
        if type(function) is ast.Name:
            if function.id in names:
                return function.id
            direct_name = self._aliases.get(function.id, "")
            if direct_name in names:
                return direct_name
            return self._reference_aliases.resolved_name(function.id, names)
        if type(function) is ast.Attribute:
            target = function.value
            if type(target) is ast.Name and target.id in self._module_names and function.attr in names:
                return function.attr
        return ""

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        reference_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _initialization builtin reflection state_."""
        self._aliases: dict[str, str] = {}
        self._module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        self._reference_aliases: PythonReferenceAliasesContract = reference_aliases
        self._container_aliases: PythonContainerAliasesContract = container_aliases

    def configure(self, tree: ast.AST, nodes: AstNodeList) -> None:
        """Responsibilities: _configuration builtin reflection imports_."""
        self._reset()
        if type(tree) is not ast.Module:
            return
        configured_nodes = nodes
        self._configure_imports(configured_nodes)
        self._reference_aliases.collect(tree, configured_nodes)
        for node in configured_nodes:
            for target, value in self._assignment_values(node).items():
                name = self._builtin_name(value)
                if name:
                    self._aliases.update({target: name})

    def resolve(self, function: ast.AST, names: frozenset[str]) -> str:
        """Responsibilities: _reflection callable identity_."""
        while type(function) is ast.Subscript:
            resolved = self._container_aliases.container_values().container_value(function)
            if not resolved.found():
                return ""
            function = resolved.expression_node()
        return self._resolve_identity(function, names)
