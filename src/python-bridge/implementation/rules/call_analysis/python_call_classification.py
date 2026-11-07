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

    def _assertion_call_kind(
        self,
        assertion_method: ast.Attribute,
        assertion_call: ast.Call,
    ) -> str:
        """Responsibilities: _assertion invocation category_."""
        if not assertion_method.attr.startswith("assert"):
            return ""
        if self._condition_context.test_function(assertion_call):
            return PYTHON_ASSERTION_IN_TEST_RULE
        return PYTHON_ASSERTION_OUTSIDE_TEST_RULE

    def _setattr_call_kind(
        self,
        target: ast.Name,
        setattr_method: ast.Attribute,
    ) -> str:
        """Responsibilities: _object mutation invocation category_."""
        if setattr_method.attr != PYTHON_SETATTR_METHOD:
            return ""
        if target.id == "object":
            return PYTHON_OBJECT_SETATTR_RULE
        target_name = self._reference_aliases.target_name(target.id)
        if target_name.endswith("object"):
            return PYTHON_OBJECT_SETATTR_RULE
        return ""

    def _super_setattr_call(self, super_setattr_method: ast.Attribute) -> bool:
        """Responsibilities: _base object mutation_."""
        if super_setattr_method.attr != PYTHON_SETATTR_METHOD:
            return False
        value = super_setattr_method.value
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "super":
            return False
        if value.args:
            return False
        return not value.keywords

    def _self_call_kind(
        self,
        self_method: ast.Attribute,
        self_assertion_call: ast.Call,
    ) -> str:
        """Responsibilities: _instance assertion category_."""
        match self_method.value:
            case ast.Name(id=receiver_name) if receiver_name == PYTHON_SELF_NAME:
                return self._assertion_call_kind(self_method, self_assertion_call)
            case _:
                return ""

    def _named_attribute_kind(
        self,
        target: ast.Name,
        function: ast.Attribute,
        invocation: ast.Call,
    ) -> str:
        """Responsibilities: _named receiver invocation classification_."""
        assertion_kind = self._self_call_kind(function, invocation)
        if assertion_kind:
            return assertion_kind
        setattr_kind = self._setattr_call_kind(target, function)
        if setattr_kind:
            return setattr_kind
        if function.attr == PYTHON_INIT_METHOD:
            return PYTHON_DIRECT_CLASS_INIT_RULE
        return ""

    def __init__(
        self,
        aliases: PythonReferenceAliasesContract,
        container_values: PythonContainerValuesContract,
        condition_context: PythonCallableConditionContextContract,
    ) -> None:
        """Responsibilities: _classifier dependency setup_."""
        self._reference_aliases: PythonReferenceAliasesContract = aliases
        self._container_values: PythonContainerValuesContract = container_values
        self._condition_context: PythonCallableConditionContextContract = condition_context

    def classify_attribute(
        self,
        function: ast.Attribute,
        attribute_invocation: ast.Call,
    ) -> str:
        """Responsibilities: _attribute invocation category_."""
        if self._super_setattr_call(function):
            return PYTHON_OBJECT_SETATTR_RULE
        match function.value:
            case ast.Name() as target:
                pass
            case _:
                return ""
        return self._named_attribute_kind(target, function, attribute_invocation)

    def classify_subscript(
        self,
        function: ast.Subscript,
        indexed_invocation: ast.Call,
    ) -> str:
        """Responsibilities: _indexed callable category_."""
        resolved = self._container_values.container_value(function)
        if not resolved.found():
            return ""
        expression = resolved.expression_node()
        if type(expression) is ast.Name:
            return self.classify_name(expression)
        if type(expression) is ast.Attribute:
            return self.classify_attribute(expression, indexed_invocation)
        return ""

    def classify_name(self, function: ast.Name) -> str:
        """Responsibilities: _named invocation category_."""
        target_name = self._reference_aliases.target_name(function.id)
        if target_name.endswith(f".{PYTHON_INIT_METHOD}"):
            return PYTHON_DIRECT_CLASS_INIT_RULE
        if target_name.endswith(f".{PYTHON_SETATTR_METHOD}"):
            return PYTHON_OBJECT_SETATTR_RULE
        return ""

    def resolved_kind(self, invocation: ast.Call, function: ast.AST) -> str:
        """Responsibilities: _callable classification_."""
        match function:
            case ast.Name() as name:
                return self.classify_name(name)
            case ast.Attribute() as attribute:
                return self.classify_attribute(attribute, invocation)
            case ast.Subscript() as subscript:
                return self.classify_subscript(subscript, invocation)
            case _:
                return ""

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _special invocation category_."""
        if type(node) is not ast.Call:
            return ""
        return self.resolved_kind(node, node.func)
