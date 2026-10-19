from __future__ import annotations

import ast

from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_COLLECTIONS_MODULE,
    PYTHON_COLLECTION_TYPE_FACTORIES,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
    PYTHON_TYPING_TYPE_FACTORIES,
    TYPE_FACTORIES,
)


class PythonTypeFactoryNames:
    """Responsibilities: _factory import alias tracking_, _factory expression matching_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported factory name_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name

    def _factory_module(self, module: str, name: str) -> bool:
        """Responsibilities: _factory declaration origin validation_."""
        if module in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
            return name in PYTHON_TYPING_TYPE_FACTORIES
        return (
            module == PYTHON_COLLECTIONS_MODULE
            and name in PYTHON_COLLECTION_TYPE_FACTORIES
        )

    def _configure_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported factory aliases_."""
        module = node.module or ""
        for imported in node.names:
            if imported.name not in self.factory_names:
                continue
            if not self._factory_module(module, imported.name):
                continue
            self.aliases.add(self._local_name(imported))

    def _expression_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution factory expression name_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(value)
            if resolved.found():
                return self._expression_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in self.aliases:
                return value.id
        if type(value) is ast.Attribute and value.attr in self.factory_names:
            if type(value.value) is ast.Name:
                module = self.module_aliases.get(value.value.id, value.value.id)
                if self._factory_module(module, value.attr):
                    return value.attr
        return ""

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _configuration assigned factory aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
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

    def _configure_tuple_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration tuple aliases_."""
        if node.module not in (
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        ):
            return
        for imported in node.names:
            if imported.name in {"Tuple", "tuple"}:
                self.tuple_aliases.add(self._local_name(imported))

    def _tuple_expression(self, value: ast.AST) -> bool:
        """Responsibilities: _classification tuple expression_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(value)
            if not resolved.found():
                return False
            return self._tuple_expression(resolved.expression_node())
        if type(value) is ast.Name:
            return value.id in self.tuple_aliases
        if type(value) is ast.Attribute:
            if type(value.value) is not ast.Name:
                return False
            module = self.module_aliases.get(value.value.id, value.value.id)
            return (
                module in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE)
                and value.attr == "Tuple"
            )
        return False

    def _configure_tuple_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration tuple assignments_."""
        if type(node) is ast.Assign:
            targets = node.targets
            value = node.value
        else:
            if type(node) is ast.AnnAssign and node.value is not None:
                targets = [node.target]
                value = node.value
            else:
                return
        for target in targets:
            values = self.assignment_aliases.target_values(target, value, False)
            for name, source in values.items():
                self.tuple_aliases.discard(name)
                if self._tuple_expression(source):
                    self.tuple_aliases.add(name)

    def _observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation factory aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom:
            self._configure_import(node)
        if type(node) is ast.Import:
            for imported in node.names:
                if imported.name in (
                    PYTHON_TYPING_MODULE,
                    PYTHON_TYPING_EXTENSIONS_MODULE,
                ):
                    self.module_aliases[imported.asname or imported.name] = (
                        imported.name
                    )
        self._configure_assignment(node)

    def _observe_tuple(self, node: ast.AST) -> None:
        """Responsibilities: _observation tuple aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom:
            self._configure_tuple_import(node)
        self._configure_tuple_assignment(node)

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _initialization factory alias state_."""
        self.factory_names: frozenset[str] = TYPE_FACTORIES
        self.aliases: set[str] = set()
        self.module_aliases: dict[str, str] = {}
        self.tuple_aliases: set[str] = {"Tuple", "tuple"}
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self.container_aliases: PythonContainerAliasesContract = container_aliases

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration factory import aliases_."""
        self.container_aliases.clear()
        if type(tree) is ast.Module:
            for node in tree.body:
                self._observe(node)

    def configure_tuple(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration tuple import aliases_."""
        if type(tree) is ast.Module:
            for node in tree.body:
                self._observe_tuple(node)

    def tuple_annotation(self, value: ast.AST) -> bool:
        """Responsibilities: _classification tuple annotation_."""
        if type(value) is not ast.Subscript:
            return False
        return self._tuple_expression(value.value)

    def matches(self, value: ast.AST) -> bool:
        """Responsibilities: _classification factory expression_."""
        return bool(self._expression_name(value))
