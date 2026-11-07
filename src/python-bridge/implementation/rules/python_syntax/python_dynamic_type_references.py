from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.python_container_lookup import PythonContainerLookup
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerLookupContract,
    PythonContainerValuesContract,
)
from implementation.rules.constants import PYTHON_BUILTINS_MODULE


class PythonDynamicTypeReferences:
    """Responsibilities: _dynamic type names_, _factory identities_."""

    def _resolved_call_function(
        self,
        factory_call: ast.Call,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _dynamic factory function expression_."""
        function: ast.AST = factory_call.func
        if type(function) is ast.Subscript:
            resolved = self._lookup_values.container_value(function)
            if not resolved.found():
                return PythonContainerLookup(found_value=False, expression=function)
            function = resolved.expression_node()
        if type(function) is ast.Attribute:
            resolved = self._lookup_values.attribute_value(function)
            if resolved.found():
                function = resolved.expression_node()
        return PythonContainerLookup(found_value=True, expression=function)

    def _attribute_call_name(self, function: ast.Attribute) -> str:
        """Responsibilities: _module dynamic factory name_."""
        target = function.value
        if type(target) is not ast.Name:
            return ""
        if target.id not in self._module_names:
            return ""
        return function.attr

    def _getattr_reference_name(self, getattr_call: ast.Call) -> str:
        """Responsibilities: _getattr reference name_."""
        if len(getattr_call.args) < 2:
            return ""
        if type(getattr_call.func) is not ast.Name:
            return ""
        if getattr_call.func.id != "getattr":
            return ""
        target = getattr_call.args[0]
        if type(target) is not ast.Name:
            return ""
        if target.id not in self._module_names:
            return ""
        return self._container_keys.static_key(getattr_call.args[1])

    def _module_type_reference(self, value: ast.Attribute) -> str:
        """Responsibilities: _module type reference_."""
        if type(value.value) is not ast.Name:
            return ""
        if value.value.id in self._module_names:
            return "type"
        return ""

    def _reference_value(self, dynamic_reference: ast.AST) -> str:
        """Responsibilities: _dynamic type reference mapping_."""
        if type(dynamic_reference) is ast.Call:
            name = self._getattr_reference_name(dynamic_reference)
            if name == "type":
                return "type"
            return ""
        if type(dynamic_reference) is ast.Name:
            if dynamic_reference.id in self._type_names:
                return "type"
            return ""
        if type(dynamic_reference) is not ast.Attribute:
            return ""
        if dynamic_reference.attr != "type":
            return ""
        return self._module_type_reference(dynamic_reference)

    def _type_call_count(self, type_factory_call: ast.Call) -> int:
        """Responsibilities: _dynamic type-call argument count_."""
        count = 0
        for argument in type_factory_call.args:
            if type(argument) is not ast.Starred:
                count += 1
                continue
            if type(argument.value) is not ast.List and type(argument.value) is not ast.Tuple:
                return 0
            count += len(argument.value.elts)
        return count

    def __init__(
        self,
        type_names: set[str],
        module_names: set[str],
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _dynamic type reference state_."""
        self._type_names: set[str] = type_names
        self._module_names: set[str] = module_names
        self._lookup_values: PythonContainerValuesContract = container_aliases.container_values()
        self._container_keys: PythonContainerKeysContract = container_aliases.container_keys()
        self._node_index: PythonAstNodeIndexContract = container_aliases.state().node_index()

    def call_name(self, factory_invocation: ast.Call) -> str:
        """Responsibilities: _dynamic factory name_."""
        resolved = self._resolved_call_function(factory_invocation)
        if not resolved.found():
            return ""
        function = resolved.expression_node()
        if type(function) is ast.Call:
            if self._getattr_reference_name(function) == "type":
                return "type"
        if type(function) is ast.Name:
            return function.id
        if type(function) is ast.Attribute:
            return self._attribute_call_name(function)
        return ""

    def reference_name(self, type_reference_expression: ast.AST) -> str:
        """Responsibilities: _dynamic type reference_."""
        if type(type_reference_expression) is ast.Subscript:
            resolved = self._lookup_values.container_value(type_reference_expression)
            if resolved.found():
                return self.reference_name(resolved.expression_node())
            return ""
        return self._reference_value(type_reference_expression)

    def module_reference(self, module_expression: ast.AST) -> str:
        """Responsibilities: _dynamic module reference_."""
        if type(module_expression) is ast.Name:
            if module_expression.id in self._module_names:
                return PYTHON_BUILTINS_MODULE
        return ""

    def type_call_present(self, expression_tree: ast.AST) -> bool:
        """Responsibilities: _dynamic type-call presence_."""
        if type(expression_tree) is ast.Call:
            if self._type_call_count(expression_tree) == 3:
                if self.call_name(expression_tree) in self._type_names:
                    return True
        return any(self.type_call_present(child) for child in self._node_index.children(expression_tree))
