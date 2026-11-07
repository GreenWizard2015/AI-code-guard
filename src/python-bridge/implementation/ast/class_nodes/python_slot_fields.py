from __future__ import annotations

import ast

from implementation.ast.class_nodes.python_slot_expression import PythonSlotExpression
from implementation.ast.class_nodes.python_slot_statement import PythonSlotStatement
from implementation.rules.constants import (
    PYTHON_DICT_ATTRIBUTE,
    PYTHON_WEAKREF_ATTRIBUTE,
)
from implementation.types import JsonObject


class PythonSlotFields:
    """Responsibilities: _slot declaration resolution_, _alias collection_, _field normalization_."""

    _node: ast.ClassDef
    _module_body: list[ast.stmt]

    def _module_bindings(self) -> dict[str, ast.expr]:
        """Responsibilities: _module slot alias collection_."""
        bindings: dict[str, ast.expr] = {}
        for item in self._module_body:
            if item.lineno >= self._node.lineno:
                break
            statement = PythonSlotStatement(item)
            name = statement.binding_name()
            value = statement.binding_value()
            if name and not (type(value) is ast.Constant and value.value is None):
                bindings[name] = value
        return bindings

    def _bindings_before(
        self,
        target: ast.stmt,
        module_bindings: dict[str, ast.expr],
    ) -> dict[str, ast.expr]:
        """Responsibilities: _class slot alias collection_."""
        bindings = module_bindings.copy()
        for item in self._node.body:
            if item is target:
                break
            statement = PythonSlotStatement(item)
            name = statement.binding_name()
            value = statement.binding_value()
            if name and not (type(value) is ast.Constant and value.value is None):
                bindings[name] = value
        return bindings

    def __init__(self, node: ast.ClassDef, module_body: list[ast.stmt]) -> None:
        """Responsibilities: _slot declaration initialization_."""
        self._node = node
        self._module_body = module_body

    def fields(self) -> dict[str, int]:
        """Responsibilities: _slot instance field collection_."""
        fields: dict[str, int] = {}
        module_bindings = self._module_bindings()
        for item in self._node.body:
            statement = PythonSlotStatement(item)
            value = statement.slot_value()
            if type(value) is ast.Constant and value.value is None:
                continue
            bindings = self._bindings_before(item, module_bindings)
            expression = PythonSlotExpression(value, bindings, set())
            names = expression.names()
            for name in names:
                if name not in (PYTHON_DICT_ATTRIBUTE, PYTHON_WEAKREF_ATTRIBUTE):
                    fields.setdefault(name, item.lineno - 1)
        return fields

    def untyped_fields(self, typed_names: set[str]) -> list[JsonObject]:
        """Responsibilities: _untyped slot field collection_."""
        fields: list[JsonObject] = []
        for name, line in self.fields().items():
            if name not in typed_names:
                fields.append({"line": line, "name": name})
        return fields
