from __future__ import annotations

import ast

from implementation.references.aliases.protocols import (
    PythonContainerAliasStateContract,
    PythonContainerKeysContract,
    PythonContainerLookupContract,
)
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)


class PythonContainerValues:
    """Responsibilities: _mapping entry lookup_, _sequence value expansion_."""

    def _dictionary_items(self, value: ast.Dict) -> dict[str, ast.AST]:
        """Responsibilities: _dictionary item resolution_."""
        items: dict[str, ast.AST] = {}
        for key_node, item in zip(value.keys, value.values):
            if key_node is None:
                continue
            key = self.keys.static_key(key_node)
            if key:
                items[key] = item
        return items

    def _call_items(self, value: ast.Call) -> dict[str, ast.AST]:
        """Responsibilities: _container constructor item mapping_."""
        if type(value.func) is not ast.Name:
            return {}
        if value.func.id not in {"list", "set", "tuple"}:
            return {}
        if len(value.args) != 1:
            return {}
        return self._items(value.args[0])

    def _resolved_items(self, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _nested container item mapping_."""
        if type(value) is ast.Subscript:
            resolved = self.container_value(value)
        else:
            resolved = self.attribute_value(value)
        if not resolved.found():
            return {}
        return self._items(resolved.expression_node())

    def _items(self, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _static container item collection_."""
        self.state.select_scope_node(value)
        if type(value) is ast.Name:
            return self.state.container_alias(value.id)
        if type(value) is ast.Dict:
            return self._dictionary_items(value)
        if type(value) in (ast.List, ast.Tuple, ast.Set):
            return {str(index): item for index, item in enumerate(value.elts)}
        if type(value) is ast.Call:
            return self._call_items(value)
        if type(value) in (ast.Subscript, ast.Attribute):
            return self._resolved_items(value)
        return {}

    def _lookup_item(self, value: ast.AST, key: str) -> PythonContainerLookupContract:
        """Responsibilities: _static container item resolution_."""
        if type(value) is ast.Name:
            return self.state.container_item(value.id, key)
        else:
            item = self._items(value).get(key)
        if item is None:
            return PythonContainerLookup(False, value)
        return PythonContainerLookup(True, item)

    def _builtin_item(self, value: ast.AST, key: str) -> PythonContainerLookupContract:
        """Responsibilities: _builtins dictionary item resolution_."""
        if not self.state.builtin_dictionary(value):
            return PythonContainerLookup(False, value)
        if key == "":
            return PythonContainerLookup(False, value)
        return PythonContainerLookup(True, ast.Name(id=key, ctx=ast.Load()))

    def _sequence_values(self, value: ast.AST) -> list[ast.AST]:
        """Responsibilities: _sequence value expansion_."""
        values: list[ast.AST] = []
        for item in value.elts:
            if type(item) is ast.Starred:
                values.extend(self.container_values(item.value))
                continue
            values.append(item)
        return values

    def _call_values(self, value: ast.Call) -> list[ast.AST]:
        """Responsibilities: _container constructor value expansion_."""
        if type(value.func) is not ast.Name:
            return []
        if value.func.id not in {"list", "set", "tuple"}:
            return []
        if len(value.args) != 1:
            return []
        return self.container_values(value.args[0])

    def _subscript_values(self, value: ast.Subscript) -> list[ast.AST]:
        """Responsibilities: _subscript value expansion_."""
        resolved = self.container_value(value)
        if not resolved.found():
            return []
        nested = self.container_values(resolved.expression_node())
        if nested:
            return nested
        return [resolved.expression_node()]

    def _nested_attribute_value(
        self, value: ast.Attribute
    ) -> PythonContainerLookupContract:
        """Responsibilities: _nested attribute value resolution_."""
        if type(value.value) is ast.Subscript:
            resolved = self.container_value(value.value)
        else:
            resolved = self.attribute_value(value.value)
        if not resolved.found():
            return PythonContainerLookup(False, value)
        nested = self._lookup_item(resolved.expression_or(value.value), value.attr)
        if nested.found():
            return nested
        expression = ast.Attribute(
            value=resolved.expression_node(), attr=value.attr, ctx=ast.Load()
        )
        return PythonContainerLookup(True, expression)

    def __init__(
        self,
        state: PythonContainerAliasStateContract,
        keys: PythonContainerKeysContract,
    ) -> None:
        """Responsibilities: _container value state binding_."""
        self.state: PythonContainerAliasStateContract = state
        self.keys: PythonContainerKeysContract = keys

    def container_values(self, value: ast.AST) -> list[ast.AST]:
        """Responsibilities: _container value expansion_."""
        if type(value) is ast.Starred:
            return self.container_values(value.value)
        if type(value) is ast.Name:
            return list(self.state.container_alias(value.id).values())
        if type(value) in (ast.List, ast.Tuple, ast.Set):
            return self._sequence_values(value)
        if type(value) is ast.Dict:
            return [item for item in value.values if item is not None]
        if type(value) is ast.Call:
            return self._call_values(value)
        if type(value) is ast.Subscript:
            return self._subscript_values(value)
        return []

    def container_value(self, value: ast.Subscript) -> PythonContainerLookupContract:
        """Responsibilities: _container value resolution_."""
        if type(value.slice) is ast.Slice:
            return PythonContainerLookup(True, value.value)
        key = self.keys.static_key(value.slice)
        if not key:
            return PythonContainerLookup(False, value.slice)
        builtin = self._builtin_item(value.value, key)
        if builtin.found():
            return builtin
        if type(value.value) is ast.Subscript:
            nested = self.container_value(value.value)
            if not nested.found():
                return nested
            return self._lookup_item(nested.expression_node(), key)
        return self._lookup_item(value.value, key)

    def attribute_value(self, value: ast.Attribute) -> PythonContainerLookupContract:
        """Responsibilities: _container property resolution_."""
        if type(value.value) in (ast.Subscript, ast.Attribute):
            return self._nested_attribute_value(value)
        return self._lookup_item(value.value, value.attr)
