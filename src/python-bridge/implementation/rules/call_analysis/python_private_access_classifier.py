from __future__ import annotations

import ast
from typing import Any

from implementation.ast.protocols import PythonPrivateAccessOptionsContract
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.protocols import PythonPrivateVarsMappingContract
from implementation.rules.constants import (
    PYTHON_CLASS_NAME,
    PYTHON_CONTAINER_KEYS_KEY,
    PYTHON_GETATTRIBUTE_METHOD,
    PYTHON_PRIVATE_VARS_MAPPING_KEY,
    PYTHON_REFLECTION_NAMES_KEY,
    PYTHON_SELF_NAME,
    PYTHON_SETATTR_METHOD,
)


class PythonPrivateAccessClassifier:
    """Responsibilities: _private access detection_, _access location collection_."""

    def _builtin_call(self, node: ast.Call, members: set[str]) -> bool:
        """Responsibilities: _classification builtin access targets_."""
        if len(node.args) < 2:
            return False
        option_data = self.options.data()
        container_keys = option_data[PYTHON_CONTAINER_KEYS_KEY]
        member = container_keys.string_value(node.args[1])
        if member not in members:
            return False
        target: Any = node.args[0]
        if type(target) is ast.Name:
            if target.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}:
                return False
        return True

    def _attribute_call(
        self, node: ast.Call, target: ast.AST, members: set[str]
    ) -> bool:
        """Responsibilities: _classification attribute invocation access_."""
        if not node.args:
            return False
        option_data = self.options.data()
        container_keys = option_data[PYTHON_CONTAINER_KEYS_KEY]
        member = container_keys.string_value(node.args[0])
        if member not in members:
            return False
        if type(target) is ast.Name:
            if target.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}:
                return False
        return True

    def _private_call(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification direct invocation private_."""
        if type(node) is not ast.Call:
            return False
        option_data = self.options.data()
        reflection_names: PythonReflectionNamesContract = option_data[
            PYTHON_REFLECTION_NAMES_KEY
        ]
        if self._reflection_call(node, members, reflection_names):
            return True
        return self._attribute_reflection_call(node, members)

    def _reflection_call(
        self,
        node: ast.Call,
        members: set[str],
        reflection_names: PythonReflectionNamesContract,
    ) -> bool:
        """Responsibilities: _reflection access invocation classification_."""
        function: Any = node.func
        reflection_name = reflection_names.access_name(function)
        if reflection_name:
            if reflection_name == "vars":
                return False
            return self._builtin_call(node, members)
        return False

    def _attribute_reflection_call(self, node: ast.Call, members: set[str]) -> bool:
        """Responsibilities: _attribute reflection invocation classification_."""
        function: Any = node.func
        if type(function) is not ast.Attribute:
            return False
        if function.attr not in {PYTHON_GETATTRIBUTE_METHOD, PYTHON_SETATTR_METHOD}:
            return False
        return self._attribute_call(node, function.value, members)

    def __init__(self, options: PythonPrivateAccessOptionsContract) -> None:
        """Responsibilities: _private access classifier initialization_."""
        self.options: PythonPrivateAccessOptionsContract = options

    def private_access(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification supported private access_."""
        if self._private_call(node, members):
            return True
        option_data = self.options.data()
        private_vars_mapping: PythonPrivateVarsMappingContract = option_data[
            PYTHON_PRIVATE_VARS_MAPPING_KEY
        ]
        return private_vars_mapping.access(node, members)

    def attribute_lines(self, node: ast.AST, members: set[str]) -> set[int]:
        """Responsibilities: _private attribute lines_."""
        if type(node) is not ast.Attribute:
            return set()
        if node.attr not in members:
            return set()
        is_instance_access = type(node.value) is ast.Name
        if is_instance_access:
            is_instance_access = node.value.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}
        if is_instance_access:
            return set()
        return {node.lineno - 1}
