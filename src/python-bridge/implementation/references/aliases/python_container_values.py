from __future__ import annotations

import ast
from typing import cast

from implementation.references.alias_types import (
    ExpandedContainerValues,
    PythonContainerItemRequest,
    SequenceExpression,
)
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.references.protocols import (
    PythonContainerAliasStateContract,
    PythonContainerItemRequestContract,
    PythonContainerItemsContract,
    PythonContainerKeysContract,
    PythonContainerLookupContract,
)


class PythonContainerValues:
    """Responsibilities: _sequence value expansion_, _nested value resolution_."""

    def _sequence_values(
        self,
        expression: SequenceExpression,
    ) -> ExpandedContainerValues:
        """Responsibilities: _starred sequence expansion_."""
        values: ExpandedContainerValues = []
        for item in expression.elts:
            match item:
                case ast.Starred(value=value):
                    values.extend(self.container_values(value))
                case _:
                    values.append(item)
        return values

    def _call_values(self, expression: ast.Call) -> ExpandedContainerValues:
        """Responsibilities: _container constructor expansion_."""
        match expression:
            case ast.Call(func=ast.Name(id=name), args=[argument]) if name in {
                "list",
                "set",
                "tuple",
            }:
                return self.container_values(argument)
            case _:
                return []

    def _subscript_values(self, expression: ast.Subscript) -> ExpandedContainerValues:
        """Responsibilities: _subscript element expansion_."""
        resolved = self.container_value(expression)
        if not resolved.found():
            return []
        nested_expression = resolved.expression_node()
        nested_values: ExpandedContainerValues = self.container_values(
            nested_expression,
        )
        if nested_values:
            return nested_values
        return [nested_expression]

    def _item_at_container(
        self,
        request: PythonContainerItemRequestContract,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _nested container item resolution_."""
        match request.expression:
            case ast.Subscript() as subscript:
                self._state.select_scope_node(subscript)
                return self._nested_item(self.container_value(subscript), request.key)
            case ast.Attribute() as attribute:
                self._state.select_scope_node(attribute)
                return self._nested_item(self.attribute_value(attribute), request.key)
            case ast.Call(func=ast.Name(id=name), args=[argument]) if name in {
                "list",
                "set",
                "tuple",
            }:
                return self._constructor_item(argument, request.key)
            case _:
                return self._items.item(request.expression, request.key)

    def _nested_item(
        self,
        resolved: PythonContainerLookupContract,
        key: str,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _recursive nested item lookup_."""
        if not resolved.found():
            return resolved
        request = PythonContainerItemRequest(resolved.expression_node(), key)
        return self._item_at_container(request)

    def _constructor_item(
        self,
        argument: ast.expr,
        key: str,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _container constructor item lookup_."""
        self._state.select_scope_node(argument)
        request = PythonContainerItemRequest(argument, key)
        return self._item_at_container(request)

    def _attribute_expression(
        self,
        value: ast.Attribute,
        resolved: PythonContainerLookupContract,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _attribute lookup_."""
        request = PythonContainerItemRequest(
            resolved.expression_or(value.value),
            value.attr,
        )
        nested = self._item_at_container(request)
        if nested.found():
            return nested
        expression = ast.Attribute(
            value=cast(ast.expr, resolved.expression_node()),
            attr=value.attr,
            ctx=ast.Load(),
        )
        return PythonContainerLookup(found_value=True, expression=expression)

    def __init__(
        self,
        state: PythonContainerAliasStateContract,
        keys: PythonContainerKeysContract,
        items: PythonContainerItemsContract,
    ) -> None:
        """Responsibilities: _container expansion dependencies_."""
        self._state: PythonContainerAliasStateContract = state
        self._keys: PythonContainerKeysContract = keys
        self._items: PythonContainerItemsContract = items

    def container_value(self, value: ast.Subscript) -> PythonContainerLookupContract:
        """Responsibilities: _container value resolution_."""
        match value.slice:
            case ast.Slice():
                return PythonContainerLookup(found_value=True, expression=value.value)
            case _:
                key = self._keys.static_key(value.slice)
        if not key:
            return PythonContainerLookup(found_value=False, expression=value.slice)
        builtin = self._items.builtin_item(value.value, key)
        if builtin.found():
            return builtin
        request = PythonContainerItemRequest(value.value, key)
        return self._item_at_container(request)

    def container_values(self, expression: ast.AST) -> ExpandedContainerValues:
        """Responsibilities: _container value expansion_."""
        match expression:
            case ast.Name(id=name):
                return list(self._state.alias(name).values().values())
            case ast.Dict() as dictionary:
                return [item for item in dictionary.values if item is not None]
            case (ast.List() | ast.Tuple() | ast.Set()) as sequence:
                return self._sequence_values(sequence)
            case ast.Call() as call:
                return self._call_values(call)
            case ast.Subscript() as subscript:
                return self._subscript_values(subscript)
            case ast.Starred(value=value):
                return self.container_values(value)
            case _:
                return []

    def attribute_value(self, value: ast.Attribute) -> PythonContainerLookupContract:
        """Responsibilities: _container property resolution_."""
        match value.value:
            case ast.Subscript() as subscript:
                resolved = self.container_value(subscript)
            case ast.Attribute() as attribute:
                resolved = self.attribute_value(attribute)
            case _:
                return self._items.item(value.value, value.attr)
        if not resolved.found():
            return PythonContainerLookup(found_value=False, expression=value)
        return self._attribute_expression(value, resolved)
