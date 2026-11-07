from __future__ import annotations

import ast

from implementation.protocols import (
    PythonCallAliasStateContract,
)
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.constants import (
    ALL_REFLECTION_CALLS,
    PYTHON_BUILTINS_MODULE,
    REFLECTION_CALLS,
)


class PythonCallReflectionIndex:
    """Responsibilities: _reflection aliases_, _builtin module names_."""

    _aliases: dict[str, str]
    _module_names: set[str]
    _container_aliases: PythonCallAliasStateContract
    _reference_aliases: PythonReferenceAliasesContract

    def _alias_name(self, name: str) -> str:
        """Responsibilities: _reflection alias resolution_."""
        if name in REFLECTION_CALLS:
            return name
        target = self._aliases.get(name, "")
        if target in REFLECTION_CALLS:
            return target
        return self._reference_aliases.resolved_name(name, REFLECTION_CALLS)

    def _builtin_name(self, value: ast.AST) -> str:
        """Responsibilities: _builtin reflection identity_."""
        if type(value) is ast.Subscript:
            resolved = self._container_aliases.container_value(value)
            if resolved.found():
                return self._builtin_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in REFLECTION_CALLS:
                return value.id
            return ""
        if type(value) is ast.Attribute:
            return self._attribute_name(value)
        return ""

    def _subscript_name(self, function: ast.Subscript) -> str:
        """Responsibilities: _reflection subscript identity_."""
        resolved = self._container_aliases.container_value(function)
        if not resolved.found():
            return ""
        return self.resolve(resolved.expression_node())

    def _attribute_name(self, function: ast.Attribute) -> str:
        """Responsibilities: _reflection module attribute identity_."""
        if type(function.value) is not ast.Name:
            return ""
        if function.value.id not in self._module_names:
            return ""
        if function.attr in REFLECTION_CALLS:
            return function.attr
        return ""

    def _observe_import(self, node: ast.AST) -> None:
        """Responsibilities: _reflection import indexing_."""
        if type(node) is ast.ImportFrom and node.module == PYTHON_BUILTINS_MODULE:
            for imported in node.names:
                if imported.name in ALL_REFLECTION_CALLS:
                    self._aliases.update({imported.asname or imported.name: imported.name})
        if type(node) is ast.Import:
            for imported in node.names:
                if imported.name == PYTHON_BUILTINS_MODULE:
                    self._module_names.add(imported.asname or imported.name)

    def _assignment_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _reflection assignment targets_."""
        values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign:
            for target in node.targets:
                values.update(
                    self._reference_aliases.target_values(target, node.value, references_only=False),
                )
        if type(node) is ast.AnnAssign and node.value is not None:
            values.update(
                self._reference_aliases.target_values(node.target, node.value, references_only=False),
            )
        return values

    def _resolve_assignments(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _reflection assignment aliases_."""
        for node in nodes:
            for target, value in self._assignment_values(node).items():
                name = self._builtin_name(value)
                if name:
                    self._aliases.update({target: name})

    def __init__(
        self,
        container_aliases: PythonCallAliasStateContract,
        reference_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _reflection index dependencies_."""
        self._aliases = {}
        self._module_names = {PYTHON_BUILTINS_MODULE}
        self._container_aliases = container_aliases
        self._reference_aliases = reference_aliases

    def configure(self, tree: ast.AST, nodes: list[ast.AST]) -> None:
        """Responsibilities: _reflection alias indexing_."""
        self._aliases.clear()
        self._module_names.clear()
        self._module_names.add(PYTHON_BUILTINS_MODULE)
        self._container_aliases.observe_all(nodes)
        if type(tree) is not ast.Module:
            return
        self._reference_aliases.collect(tree, nodes)
        for node in nodes:
            self._observe_import(node)
        self._resolve_assignments(nodes)

    def resolve(self, function: ast.AST) -> str:
        """Responsibilities: _reflection function identity_."""
        if type(function) is ast.Subscript:
            return self._subscript_name(function)
        if type(function) is ast.Name:
            named = self._container_aliases.named_value(function.id)
            if named.found():
                return self.resolve(named.expression_node())
            return self._alias_name(function.id)
        if type(function) is ast.Attribute:
            return self._attribute_name(function)
        return ""
