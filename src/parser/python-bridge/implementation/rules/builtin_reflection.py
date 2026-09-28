from __future__ import annotations


import ast
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.rules.constants import (
    ALL_REFLECTION_CALLS,
    PRIVATE_ACCESS_CALLS,
    REFLECTION_CALLS,
)


class PythonBuiltinReflectionNames:
    """Responsibilities: _builtin reflection resolution_."""

    def _configure_imported_functions(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported reflection functions_."""
        if node.module != "builtins":
            return
        for imported in node.names:
            if imported.name not in ALL_REFLECTION_CALLS:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.aliases[local_name] = imported.name

    def _configure_imported_modules(self, node: ast.Import) -> None:
        """Responsibilities: _configuration imported builtin modules_."""
        for imported in node.names:
            if imported.name != "builtins":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.module_names.add(local_name)

    def _alias_name(self, name: str, names: frozenset[str]) -> str:
        """Responsibilities: _alias reflection target_."""
        if name in names:
            return name
        direct_name = self.aliases.get(name, "")
        if direct_name in names:
            return direct_name
        return self.reference_aliases.resolved_name(name, names)

    def _builtin_name(self, value: ast.AST) -> str:
        """Responsibilities: _builtin reflection identity_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
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
        if target.id in self.module_names:
            if value.attr in REFLECTION_CALLS:
                return value.attr
        return ""

    def _mapped_function_name(self, function: ast.AST, names: frozenset[str]) -> str:
        """Responsibilities: _reflection callable identity_."""
        if type(function) is ast.Subscript:
            return self._mapped_subscript_name(function, names)
        if type(function) is ast.Name:
            return self._alias_name(function.id, names)
        if type(function) is not ast.Attribute:
            return ""
        return self._mapped_attribute_name(function, names)

    def _mapped_subscript_name(
        self, function: ast.Subscript, names: frozenset[str]
    ) -> str:
        """Responsibilities: _reflection subscript identity_."""
        resolved = self.container_aliases.values.container_value(function)
        if not resolved.found():
            return ""
        return self._mapped_function_name(resolved.expression_node(), names)

    def _mapped_attribute_name(
        self, function: ast.Attribute, names: frozenset[str]
    ) -> str:
        """Responsibilities: _reflection attribute identity_."""
        target = function.value
        if type(target) is not ast.Name:
            return ""
        if target.id not in self.module_names:
            return ""
        if function.attr in names:
            return function.attr
        return ""

    def _reset(self) -> None:
        """Responsibilities: _reflection state reset_."""
        self.aliases.clear()
        self.module_names.clear()
        self.module_names.add("builtins")
        self.container_aliases.clear()

    def _observe_configuration(self, node: ast.AST) -> None:
        """Responsibilities: _reflection import observation_."""
        if type(node) is ast.ImportFrom:
            self._configure_imported_functions(node)
        if type(node) is ast.Import:
            self._configure_imported_modules(node)
        self.container_aliases.observe(node)

    def _assignment_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _reflection assignment target collection_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign:
            for target in node.targets:
                target_values.update(
                    self.reference_aliases.target_values(
                        target, node.value, references_only=False
                    )
                )
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values.update(
                self.reference_aliases.target_values(
                    node.target, node.value, references_only=False
                )
            )
        return target_values

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _reflection alias assignment_."""
        for target, value in self._assignment_values(node).items():
            name = self._builtin_name(value)
            if name:
                self.aliases[target] = name

    def __init__(self) -> None:
        """Responsibilities: _initialization builtin reflection state_."""
        self.aliases: dict[str, str] = {}
        self.module_names: set[str] = {"builtins"}
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration builtin reflection imports_."""
        self._reset()
        if type(tree) is not ast.Module:
            return
        for node in ast.walk(tree):
            self._observe_configuration(node)
        self.reference_aliases.collect(tree)
        for node in ast.walk(tree):
            self._configure_assignment(node)

    def name(self, function: ast.AST) -> str:
        """Responsibilities: _resolution builtin reflection function_."""
        return self._mapped_function_name(function, REFLECTION_CALLS)

    def access_name(self, function: ast.AST) -> str:
        """Responsibilities: _resolution private reflection function_."""
        return self._mapped_function_name(function, PRIVATE_ACCESS_CALLS)
