from __future__ import annotations

import ast

from implementation.references.protocols import PythonDecoratorNameContract
from implementation.references.protocols import PythonContainerValuesContract


class PythonDecoratorName(PythonDecoratorNameContract):
    """Responsibilities: _expression decorator names_, _imported decorator names_."""

    def __init__(self, container_values: PythonContainerValuesContract) -> None:
        """Responsibilities: _container value resolution setup_."""
        self.container_values: PythonContainerValuesContract = container_values

    def expression_name(self, value: ast.AST) -> str:
        """Responsibilities: _decorator expression name resolution_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        if type(value) is ast.Subscript:
            resolved = self.container_values.container_value(value)
            if resolved.found():
                return self.expression_name(resolved.expression_node())
        if type(value) is ast.Call and type(value.func) is ast.Name:
            return value.func.id
        return ""

    def imported_name(self, imported: ast.alias) -> str:
        """Responsibilities: _imported decorator name resolution_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name
