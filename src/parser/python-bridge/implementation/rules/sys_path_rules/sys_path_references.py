from __future__ import annotations

import ast
from typing import Any

from implementation.rules.protocols import PythonSysPathAliasesProtocol


class PythonSysPathReferences:
    """Responsibilities: _sys.path reference analysis_."""

    def _path_attribute_target(self, target: ast.Attribute) -> bool:
        """Responsibilities: _sys.path attribute target_."""
        value: Any = target.value
        if type(value) is not ast.Name:
            return False
        if not self.aliases.system_name(value.id):
            return False
        return target.attr == "path"

    def _path_subscript_target(self, target: ast.Subscript) -> bool:
        """Responsibilities: _sys.path subscript target_."""
        value: Any = target.value
        if type(value) is ast.Name:
            return self.aliases.path_name(value.id)
        if type(value) is not ast.Attribute:
            return False
        if value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        return self.aliases.system_name(value.value.id)

    def _path_reference(self, value: ast.AST) -> bool:
        """Responsibilities: _sys.path reference resolution_."""
        if type(value) is ast.Name:
            return self.aliases.path_name(value.id)
        if type(value) is ast.Attribute:
            return self._path_attribute_target(value)
        if type(value) is ast.Call:
            return self._path_call_reference(value)
        if type(value) is ast.Subscript:
            return self._path_subscript_reference(value)
        return False

    def _path_call_reference(self, value: ast.Call) -> bool:
        """Responsibilities: _getattr path reference_."""
        if len(value.args) < 2:
            return False
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "getattr":
            return False
        if type(value.args[0]) is not ast.Name:
            return False
        if not self.aliases.system_name(value.args[0].id):
            return False
        return self.aliases.container_keys.static_key(value.args[1]) == "path"

    def _path_subscript_reference(self, value: ast.Subscript) -> bool:
        """Responsibilities: _subscript path reference_."""
        resolved = self.aliases.container_values.container_value(value)
        if resolved.found():
            return self._path_reference(resolved.expression_node())
        owner = value.value
        if type(owner) is not ast.Attribute:
            return self._path_subscript_target(value)
        if owner.attr != "__dict__":
            return self._path_subscript_target(value)
        if type(owner.value) is not ast.Name:
            return self._path_subscript_target(value)
        if not self.aliases.system_name(owner.value.id):
            return self._path_subscript_target(value)
        return self.aliases.container_keys.static_key(value.slice) == "path"

    def __init__(self, aliases: PythonSysPathAliasesProtocol) -> None:
        """Responsibilities: _sys.path reference setup_."""
        self.aliases: PythonSysPathAliasesProtocol = aliases

    def path_alias_assignment(self, node: ast.AST) -> bool:
        """Responsibilities: _path alias assignment_."""
        if type(node) is not ast.Assign:
            return False
        return self._path_reference(node.value)

    def path_call(self, node: ast.Call) -> bool:
        """Responsibilities: _sys.path mutation_."""
        function: Any = node.func
        if type(function) is not ast.Attribute:
            return False
        if function.attr not in self.aliases.path_mutating:
            return False
        return self._path_reference(function.value)
