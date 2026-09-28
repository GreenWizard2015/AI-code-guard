from __future__ import annotations

import ast

from implementation.references.aliases.protocols import (
    PythonContainerAliasesProtocol,
    PythonContainerValuesProtocol,
)
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.aliases.protocols import PythonContainerLookupProtocol


class PythonDynamicTypeReferences:
    """Responsibilities: _dynamic type reference values_."""

    def _resolved_call_function(self, value: ast.Call) -> PythonContainerLookupProtocol:
        """Responsibilities: _dynamic factory function expression_."""
        function: ast.AST = value.func
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(function)
            if not resolved.found():
                return self.lookup_values.container_result(False, function)
            function = resolved.expression_node()
        if type(function) is ast.Attribute:
            resolved = self.container_aliases.values.attribute_value(function)
            if resolved.found():
                function = resolved.expression_node()
        return self.lookup_values.container_result(True, function)

    def _attribute_call_name(self, function: ast.Attribute) -> str:
        """Responsibilities: _module dynamic factory name_."""
        target = function.value
        if type(target) is not ast.Name:
            return ""
        if target.id not in self.module_names:
            return ""
        return function.attr

    def _getattr_reference_name(self, value: ast.Call) -> str:
        """Responsibilities: _getattr reference name_."""
        if len(value.args) < 2:
            return ""
        if type(value.func) is not ast.Name:
            return ""
        if value.func.id != "getattr":
            return ""
        target = value.args[0]
        if type(target) is not ast.Name:
            return ""
        if target.id not in self.module_names:
            return ""
        return self.container_keys.static_key(value.args[1])

    def _module_type_reference(self, value: ast.Attribute) -> str:
        """Responsibilities: _module type reference_."""
        if type(value.value) is not ast.Name:
            return ""
        if value.value.id in self.module_names:
            return "type"
        return ""

    def _reference_value(self, value: ast.AST) -> str:
        """Responsibilities: _dynamic type reference mapping_."""
        if type(value) is ast.Call:
            name = self._getattr_reference_name(value)
            if name == "type":
                return "type"
            return ""
        if type(value) is ast.Name:
            if value.id in self.type_names:
                return "type"
            return ""
        if type(value) is not ast.Attribute:
            return ""
        if value.attr != "type":
            return ""
        return self._module_type_reference(value)

    def __init__(
        self,
        type_names: set[str],
        module_names: set[str],
        container_aliases: PythonContainerAliasesProtocol,
        lookup_values: PythonContainerValuesProtocol,
    ) -> None:
        """Responsibilities: _dynamic type reference state binding_."""
        self.type_names: set[str] = type_names
        self.module_names: set[str] = module_names
        self.container_aliases: PythonContainerAliasesProtocol = container_aliases
        self.lookup_values: PythonContainerValuesProtocol = lookup_values
        self.container_keys: PythonContainerKeys = container_aliases.values.keys

    def call_name(self, value: ast.Call) -> str:
        """Responsibilities: _dynamic factory name_."""
        resolved = self._resolved_call_function(value)
        if not resolved.found():
            return ""
        function = resolved.expression_node()
        if type(function) is ast.Name:
            return function.id
        if type(function) is ast.Attribute:
            return self._attribute_call_name(function)
        return ""

    def reference_name(self, value: ast.AST) -> str:
        """Responsibilities: _dynamic type reference_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if resolved.found():
                return self.reference_name(resolved.expression_node())
            return ""
        return self._reference_value(value)

    def module_reference(self, value: ast.AST) -> str:
        """Responsibilities: _dynamic module reference_."""
        if type(value) is ast.Name:
            if value.id in self.module_names:
                return "builtins"
        return ""

    def type_call_present(self, value: ast.AST) -> bool:
        """Responsibilities: _dynamic type-call presence_."""
        if type(value) is ast.Call:
            if len(value.args) == 3:
                if self.call_name(value) in self.type_names:
                    return True
        for child in ast.iter_child_nodes(value):
            if self.type_call_present(child):
                return True
        return False
