from __future__ import annotations

import ast

from implementation.protocols import PythonReflectionNamesContract
from implementation.rules.call_analysis.private_access_protocols import (
    PythonPrivateAccessOptionsContract,
)
from implementation.rules.constants import (
    PRIVATE_ACCESS_CALLS,
    PYTHON_CLASS_NAME,
    PYTHON_GETATTRIBUTE_METHOD,
    PYTHON_SELF_NAME,
    PYTHON_SETATTR_METHOD,
)


class PythonPrivateAccessClassifier:
    """Responsibilities: _private access detection_, _access location collection_."""

    _member_names: frozenset[str]

    def _builtin_call(self, reflection_call: ast.Call) -> bool:
        """Responsibilities: _classification builtin access targets_."""
        if len(reflection_call.args) < 2:
            return False
        member = self._options.container_keys.string_value(reflection_call.args[1])
        if member not in self._member_names:
            return False
        target = reflection_call.args[0]
        if type(target) is ast.Name:
            if target.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}:
                return False
        return True

    def _attribute_call(self, attribute_call: ast.Call, target: ast.AST) -> bool:
        """Responsibilities: _classification attribute invocation access_."""
        if not attribute_call.args:
            return False
        member = self._options.container_keys.string_value(attribute_call.args[0])
        if member not in self._member_names:
            return False
        if type(target) is ast.Name:
            if target.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}:
                return False
        return True

    def _private_call(self, access_expression: ast.AST) -> bool:
        """Responsibilities: _classification direct invocation private_."""
        if type(access_expression) is not ast.Call:
            return False
        reflection_names = self._options.reflection_names
        if self._reflection_call(access_expression, reflection_names):
            return True
        return self._attribute_reflection_call(access_expression)

    def _reflection_call(
        self,
        builtin_invocation: ast.Call,
        reflection_names: PythonReflectionNamesContract,
    ) -> bool:
        """Responsibilities: _reflection access invocation classification_."""
        function = builtin_invocation.func
        reflection_name = reflection_names.resolve(function, PRIVATE_ACCESS_CALLS)
        if reflection_name:
            if reflection_name == "vars":
                return False
            return self._builtin_call(builtin_invocation)
        return False

    def _attribute_reflection_call(self, method_invocation: ast.Call) -> bool:
        """Responsibilities: _attribute reflection invocation classification_."""
        function = method_invocation.func
        if type(function) is not ast.Attribute:
            return False
        if function.attr not in {PYTHON_GETATTRIBUTE_METHOD, PYTHON_SETATTR_METHOD}:
            return False
        return self._attribute_call(method_invocation, function.value)

    def __init__(
        self,
        options: PythonPrivateAccessOptionsContract,
        member_names: set[str],
    ) -> None:
        """Responsibilities: _private access classifier initialization_."""
        self._options: PythonPrivateAccessOptionsContract = options
        self._member_names = frozenset(member_names)

    def private_access(self, access_expression: ast.AST) -> bool:
        """Responsibilities: _classification supported private access_."""
        if self._private_call(access_expression):
            return True
        private_vars_mapping = self._options.private_vars_mapping
        return private_vars_mapping.access(access_expression, self._member_names)

    def attribute_lines(self, attribute_access: ast.AST) -> set[int]:
        """Responsibilities: _private attribute lines_."""
        if type(attribute_access) is not ast.Attribute:
            return set()
        if attribute_access.attr not in self._member_names:
            return set()
        is_instance_access = type(attribute_access.value) is ast.Name and (
            attribute_access.value.id in {PYTHON_SELF_NAME, PYTHON_CLASS_NAME}
        )
        if is_instance_access:
            return set()
        return {attribute_access.lineno - 1}
