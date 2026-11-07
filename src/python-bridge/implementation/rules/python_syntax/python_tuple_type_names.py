from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)


class PythonTupleTypeNames:
    """Responsibilities: _tuple type alias tracking_, _tuple annotation matching_."""

    def _configure_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _tuple import alias collection_."""
        if node.module not in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
            return
        for imported in node.names:
            if imported.name in {"Tuple", "tuple"}:
                self._aliases.add(imported.asname or imported.name)

    def _tuple_attribute(self, expression: ast.Attribute) -> bool:
        """Responsibilities: _qualified tuple alias matching_."""
        if type(expression.value) is not ast.Name:
            return False
        module = self._module_aliases.get(expression.value.id, expression.value.id)
        return module in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE) and expression.attr == "Tuple"

    def _tuple_expression(self, expression: ast.AST) -> bool:
        """Responsibilities: _tuple type expression matching_."""
        if type(expression) is ast.Subscript:
            resolved = self._container_aliases.container_values().container_value(
                expression,
            )
            if not resolved.found():
                return False
            return self._tuple_expression(resolved.expression_node())
        if type(expression) is ast.Name:
            return expression.id in self._aliases
        if type(expression) is ast.Attribute:
            return self._tuple_attribute(expression)
        return False

    def _configure_target(self, target: ast.AST, assigned_expression: ast.AST) -> None:
        """Responsibilities: _tuple alias assignment tracking_."""
        aliases = self._assignment_aliases.target_values(
            target,
            assigned_expression,
            references_only=False,
        )
        for name, source in aliases.items():
            self._aliases.discard(name)
            if self._tuple_expression(source):
                self._aliases.add(name)

    def _configure_assignment(self, statement: ast.AST) -> None:
        """Responsibilities: _tuple assignment tracking_."""
        if type(statement) is ast.Assign:
            targets = statement.targets
            assigned_expression = statement.value
        else:
            if type(statement) is not ast.AnnAssign or statement.value is None:
                return
            targets = [statement.target]
            assigned_expression = statement.value
        for target in targets:
            self._configure_target(target, assigned_expression)

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _tuple alias initialization_."""
        self._container_aliases: PythonContainerAliasesContract = container_aliases
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._aliases: set[str] = {"Tuple", "tuple"}
        self._module_aliases: dict[str, str] = {}

    def observe(self, statement: ast.AST) -> None:
        """Responsibilities: _tuple aliases_."""
        self._container_aliases.observe(statement)
        if type(statement) is ast.Import:
            for imported in statement.names:
                if imported.name in (
                    PYTHON_TYPING_MODULE,
                    PYTHON_TYPING_EXTENSIONS_MODULE,
                ):
                    self._module_aliases.update({imported.asname or imported.name: imported.name})
        if type(statement) is ast.ImportFrom:
            self._configure_import(statement)
        self._configure_assignment(statement)

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _tuple type alias preparation_."""
        if type(tree) is ast.Module:
            for statement in tree.body:
                self.observe(statement)

    def annotation(self, expression: ast.AST) -> bool:
        """Responsibilities: _tuple annotation classification_."""
        if type(expression) is not ast.Subscript:
            return False
        return self._tuple_expression(expression.value)
