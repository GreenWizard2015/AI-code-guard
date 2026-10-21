from __future__ import annotations

import ast

from implementation.rules.constants import (
    PYTHON_DICT_ATTRIBUTE,
    PYTHON_SLOTS_ATTRIBUTE,
    PYTHON_WEAKREF_ATTRIBUTE,
)
from implementation.types import JsonObject


class PythonSlotFields:
    """Responsibilities: _Python slot declaration resolution_, _slot alias collection_, _instance field normalization_."""

    _node: ast.ClassDef
    _module_body: list[ast.stmt]

    def _binding_name(self, item: ast.stmt) -> str:
        """Responsibilities: _slot binding name extraction_."""
        if type(item) is ast.Assign and len(item.targets) == 1:
            target = item.targets[0]
            if type(target) is ast.Name:
                return target.id
        if type(item) is ast.AnnAssign and type(item.target) is ast.Name:
            return item.target.id
        return ""

    def _binding_value(self, item: ast.stmt) -> ast.expr:
        """Responsibilities: _slot binding expression extraction_."""
        if type(item) is ast.Assign and len(item.targets) == 1:
            return item.value
        if type(item) is ast.AnnAssign and item.value is not None:
            return item.value
        return ast.Constant(value=None)

    def _module_bindings(self) -> dict[str, ast.expr]:
        """Responsibilities: _module slot alias collection_."""
        bindings: dict[str, ast.expr] = {}
        for item in self._module_body:
            if item.lineno >= self._node.lineno:
                break
            name = self._binding_name(item)
            value = self._binding_value(item)
            if name and not (type(value) is ast.Constant and value.value is None):
                bindings[name] = value
        return bindings

    def _bindings_before(
        self, target: ast.stmt, module_bindings: dict[str, ast.expr]
    ) -> dict[str, ast.expr]:
        """Responsibilities: _class slot alias collection_."""
        bindings = module_bindings.copy()
        for item in self._node.body:
            if item is target:
                break
            name = self._binding_name(item)
            value = self._binding_value(item)
            if name and not (type(value) is ast.Constant and value.value is None):
                bindings[name] = value
        return bindings

    def _constant_names(self, value: ast.Constant) -> list[str]:
        """Responsibilities: _slot string extraction_."""
        if type(value.value) is str:
            return [value.value]
        return []

    def _alias_names(
        self, value: ast.Name, bindings: dict[str, ast.expr], seen: set[str]
    ) -> list[str]:
        """Responsibilities: _slot alias resolution_."""
        if value.id in seen:
            return []
        alias = bindings.get(value.id)
        if alias is not None:
            return self._resolved_names(alias, bindings, seen | {value.id})
        return []

    def _container_names(
        self, value: ast.expr, bindings: dict[str, ast.expr], seen: set[str]
    ) -> list[str]:
        """Responsibilities: _slot container extraction_."""
        if type(value) in (ast.Tuple, ast.List, ast.Set):
            expressions = value.elts
        else:
            if type(value) is not ast.Dict:
                return []
            expressions = [key for key in value.keys if key is not None]
        names: list[str] = []
        for expression in expressions:
            names.extend(self._resolved_names(expression, bindings, seen))
        return names

    def _resolved_names(
        self, value: ast.expr, bindings: dict[str, ast.expr], seen: set[str]
    ) -> list[str]:
        """Responsibilities: _static slot name extraction_."""
        if type(value) is ast.Constant:
            return self._constant_names(value)
        if type(value) is ast.Name:
            return self._alias_names(value, bindings, seen)
        return self._container_names(value, bindings, seen)

    def _slot_value(self, item: ast.stmt) -> ast.expr:
        """Responsibilities: _slot declaration extraction_."""
        if type(item) is ast.Assign:
            for target in item.targets:
                if type(target) is ast.Name and target.id == PYTHON_SLOTS_ATTRIBUTE:
                    return item.value
        if type(item) is ast.AnnAssign and type(item.target) is ast.Name:
            if item.target.id == PYTHON_SLOTS_ATTRIBUTE:
                return self._binding_value(item)
        return ast.Constant(value=None)

    def __init__(self, node: ast.ClassDef, module_body: list[ast.stmt]) -> None:
        """Responsibilities: _slot declaration initialization_."""
        self._node = node
        self._module_body = module_body

    def metadata_statement(self, item: ast.stmt) -> bool:
        """Responsibilities: _slot metadata classification_."""
        if type(item) is ast.Assign:
            for target in item.targets:
                if type(target) is ast.Name and target.id == PYTHON_SLOTS_ATTRIBUTE:
                    return True
        if type(item) is ast.AnnAssign and type(item.target) is ast.Name:
            return item.target.id == PYTHON_SLOTS_ATTRIBUTE
        return False

    def fields(self) -> dict[str, int]:
        """Responsibilities: _slot instance field collection_."""
        fields: dict[str, int] = {}
        module_bindings = self._module_bindings()
        for item in self._node.body:
            value = self._slot_value(item)
            if type(value) is ast.Constant and value.value is None:
                continue
            names = self._resolved_names(
                value, self._bindings_before(item, module_bindings), set()
            )
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
