from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_COLLECTION_TYPE_FACTORIES,
    PYTHON_COLLECTIONS_MODULE,
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
        return module == PYTHON_COLLECTIONS_MODULE and name in PYTHON_COLLECTION_TYPE_FACTORIES

    def _configure_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration imported factory aliases_."""
        module = node.module or ""
        for imported in node.names:
            if imported.name not in self._factory_names:
                continue
            if not self._factory_module(module, imported.name):
                continue
            self._aliases.add(self._local_name(imported))

    def _attribute_factory_name(self, expression: ast.Attribute) -> str:
        """Responsibilities: _qualified factory name resolution_."""
        if type(expression.value) is not ast.Name:
            return ""
        module = self._module_aliases.get(expression.value.id, expression.value.id)
        if not self._factory_module(module, expression.attr):
            return ""
        return expression.attr

    def _expression_name(self, factory_expression: ast.AST) -> str:
        """Responsibilities: _resolution factory expression name_."""
        if type(factory_expression) is ast.Subscript:
            resolved = self._container_aliases.container_values().container_value(
                factory_expression,
            )
            if resolved.found():
                return self._expression_name(resolved.expression_node())
            return ""
        if type(factory_expression) is ast.Name:
            if factory_expression.id in self._aliases:
                return factory_expression.id
        if type(factory_expression) is ast.Attribute:
            if factory_expression.attr in self._factory_names:
                return self._attribute_factory_name(factory_expression)
        return ""

    def _configure_assignment_targets(
        self,
        targets: list[ast.expr],
        assigned_expression: ast.AST,
    ) -> None:
        """Responsibilities: _configuration assigned factory aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self._assignment_aliases.target_values(
                    target,
                    assigned_expression,
                    references_only=False,
                ),
            )
        for target_name, source in target_values.items():
            name = self._expression_name(source)
            self._aliases.discard(target_name)
            if name:
                self._aliases.add(target_name)

    def _configure_assignment(self, assignment_statement: ast.AST) -> None:
        """Responsibilities: _configuration factory assignment aliases_."""
        if type(assignment_statement) is ast.Assign:
            self._configure_assignment_targets(
                assignment_statement.targets,
                assignment_statement.value,
            )
            return
        if type(assignment_statement) is not ast.AnnAssign or assignment_statement.value is None:
            return
        self._configure_assignment_targets(
            [assignment_statement.target],
            assignment_statement.value,
        )

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _initialization factory alias state_."""
        self._factory_names: frozenset[str] = TYPE_FACTORIES
        self._aliases: set[str] = set()
        self._module_aliases: dict[str, str] = {}
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._container_aliases: PythonContainerAliasesContract = container_aliases

    def observe(self, module_statement: ast.AST) -> None:
        """Responsibilities: _factory alias observation_."""
        self._container_aliases.observe(module_statement)
        if type(module_statement) is ast.ImportFrom:
            self._configure_import(module_statement)
        if type(module_statement) is ast.Import:
            for imported in module_statement.names:
                if imported.name in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
                    self._module_aliases.update({imported.asname or imported.name: imported.name})
        self._configure_assignment(module_statement)

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration factory import aliases_."""
        self._container_aliases.clear()
        if type(tree) is ast.Module:
            for node in tree.body:
                self.observe(node)

    def matches(self, factory_candidate: ast.AST) -> bool:
        """Responsibilities: _classification factory expression_."""
        return bool(self._expression_name(factory_candidate))
