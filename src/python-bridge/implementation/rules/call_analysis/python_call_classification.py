from __future__ import annotations

import ast

from implementation.ast.protocols import PythonCallableConditionContextContract
from implementation.references.protocols import (
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_ASSERTION_IN_TEST_RULE,
    PYTHON_ASSERTION_OUTSIDE_TEST_RULE,
    PYTHON_DIRECT_CLASS_INIT_RULE,
    PYTHON_INIT_METHOD,
    PYTHON_OBJECT_SETATTR_RULE,
    PYTHON_SELF_NAME,
    PYTHON_SETATTR_METHOD,
)


class PythonCallClassification:
    """Responsibilities: _invocation categories_, _attribute mutation policy_."""

    def _assertion_call_kind(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _assertion invocation category_."""
        if not function.attr.startswith("assert"):
            return ""
        if self.condition_context.test_function(node):
            return PYTHON_ASSERTION_IN_TEST_RULE
        return PYTHON_ASSERTION_OUTSIDE_TEST_RULE

    def _setattr_call_kind(self, target: ast.Name, function: ast.Attribute) -> str:
        """Responsibilities: _object mutation invocation category_."""
        if function.attr != PYTHON_SETATTR_METHOD:
            return ""
        if target.id == "object":
            return PYTHON_OBJECT_SETATTR_RULE
        if self.reference_aliases.target_ends_with(target.id, "object"):
            return PYTHON_OBJECT_SETATTR_RULE
        return ""

    def _super_setattr_call(self, function: ast.Attribute) -> bool:
        """Responsibilities: _base object mutation_."""
        if function.attr != PYTHON_SETATTR_METHOD:
            return False
        value = function.value
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "super":
            return False
        if value.args:
            return False
        return not value.keywords

    def _self_call_kind(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _instance assertion category_."""
        if function.value.id != PYTHON_SELF_NAME:
            return ""
        return self._assertion_call_kind(function, node)

    def __init__(
        self,
        aliases: PythonReferenceAliasesContract,
        container_values: PythonContainerValuesContract,
        condition_context: PythonCallableConditionContextContract,
    ) -> None:
        """Responsibilities: _classifier dependency setup_."""
        self.reference_aliases: PythonReferenceAliasesContract = aliases
        self.container_values: PythonContainerValuesContract = container_values
        self.condition_context: PythonCallableConditionContextContract = (
            condition_context
        )

    def classify_attribute(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _attribute invocation category_."""
        if self._super_setattr_call(function):
            return PYTHON_OBJECT_SETATTR_RULE
        if type(function.value) is not ast.Name:
            return ""
        target = function.value
        assertion_kind = self._self_call_kind(function, node)
        if assertion_kind:
            return assertion_kind
        setattr_kind = self._setattr_call_kind(target, function)
        if setattr_kind:
            return setattr_kind
        if function.attr == PYTHON_INIT_METHOD:
            return PYTHON_DIRECT_CLASS_INIT_RULE
        return ""

    def classify_subscript(self, function: ast.Subscript, node: ast.Call) -> str:
        """Responsibilities: _indexed callable category_."""
        resolved = self.container_values.container_value(function)
        if not resolved.found():
            return ""
        expression = resolved.expression_node()
        if type(expression) is ast.Name:
            return self.classify_name(expression)
        if type(expression) is ast.Attribute:
            return self.classify_attribute(expression, node)
        return ""

    def classify_name(self, function: ast.Name) -> str:
        """Responsibilities: _named invocation category_."""
        if self.reference_aliases.target_ends_with(
            function.id, f".{PYTHON_INIT_METHOD}"
        ):
            return PYTHON_DIRECT_CLASS_INIT_RULE
        if self.reference_aliases.target_ends_with(
            function.id, f".{PYTHON_SETATTR_METHOD}"
        ):
            return PYTHON_OBJECT_SETATTR_RULE
        return ""

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _special invocation category_."""
        if type(node) is not ast.Call:
            return ""
        if type(node.func) is ast.Name:
            return self.classify_name(node.func)
        if type(node.func) is ast.Subscript:
            return self.classify_subscript(node.func, node)
        if type(node.func) is not ast.Attribute:
            return ""
        return self.classify_attribute(node.func, node)
