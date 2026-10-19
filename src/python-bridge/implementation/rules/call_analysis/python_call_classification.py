from __future__ import annotations

import ast

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.protocols import (
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
    """Responsibilities: _invocation kinds_, _test context_."""

    def _test_function_parent(self, parent: ast.AST) -> bool:
        """Responsibilities: _test function classification_."""
        if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return parent.name.startswith("test_")
        return False

    def _condition_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _conditional feature detection_."""
        if type(parent) not in (ast.If, ast.While, ast.IfExp, ast.Assert):
            return False
        return parent.test is target

    def _match_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _match feature detection_."""
        if type(parent) is not ast.match_case or parent.guard is None:
            return False
        return parent.guard is target

    def _comprehension_feature(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _comprehension feature detection_."""
        if type(parent) is not ast.comprehension:
            return False
        return any(condition is target for condition in parent.ifs)

    def _named_call_kind(self, function: ast.Name) -> str:
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

    def _assertion_call_kind(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _assertion invocation category_."""
        if function.attr.startswith("assert"):
            if self.test_function(node):
                return PYTHON_ASSERTION_IN_TEST_RULE
            return PYTHON_ASSERTION_OUTSIDE_TEST_RULE
        return ""

    def _setattr_call_kind(self, target: ast.Name, function: ast.Attribute) -> str:
        """Responsibilities: _object mutation invocation category_."""
        if function.attr != PYTHON_SETATTR_METHOD:
            return ""
        if target.id == "object":
            return PYTHON_OBJECT_SETATTR_RULE
        if self.reference_aliases.target_ends_with(target.id, "object"):
            return PYTHON_OBJECT_SETATTR_RULE
        return ""

    def _attribute_call_kind(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _attribute invocation category_."""
        if type(function.value) is not ast.Name:
            return ""
        target = function.value
        if target.id == PYTHON_SELF_NAME:
            assertion_kind = self._assertion_call_kind(function, node)
            if assertion_kind:
                return assertion_kind
        setattr_kind = self._setattr_call_kind(target, function)
        if setattr_kind:
            return setattr_kind
        if function.attr == PYTHON_INIT_METHOD:
            return PYTHON_DIRECT_CLASS_INIT_RULE
        return ""

    def _subscript_call_kind(self, function: ast.Subscript, node: ast.Call) -> str:
        """Responsibilities: _indexed callable category_."""
        resolved = self.container_values.container_value(function)
        if not resolved.found():
            return ""
        expression = resolved.expression_node()
        if type(expression) is ast.Name:
            return self._named_call_kind(expression)
        if type(expression) is ast.Attribute:
            return self._attribute_call_kind(expression, node)
        return ""

    def __init__(
        self,
        aliases: PythonReferenceAliasesContract,
        container_values: PythonContainerValuesContract,
    ) -> None:
        """Responsibilities: _classifier state_."""
        self.reference_aliases: PythonReferenceAliasesContract = aliases
        self.container_values: PythonContainerValuesContract = container_values
        self.parents: dict[int, ast.AST] = {}

    def contains_callable_condition(self, node: ast.Call) -> bool:
        """Responsibilities: _callable condition detection_."""
        target: ast.AST = node
        parent = self.parents.get(id(node))
        while parent is not None:
            if self._condition_feature(parent, target):
                return True
            if self._match_feature(parent, target):
                return True
            if self._comprehension_feature(parent, target):
                return True
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                return False
            target = parent
            parent = self.parents.get(id(parent))
        return False

    def configure(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _parent index state_."""
        parents = {
            id(child): node
            for node in node_index.nodes(tree)
            for child in ast.iter_child_nodes(node)
        }
        self.parents.clear()
        self.parents.update(parents)

    def test_function(self, node: ast.AST) -> bool:
        """Responsibilities: _test function nesting_."""
        parent = self.parents.get(id(node))
        while parent is not None:
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                return self._test_function_parent(parent)
            parent = self.parents.get(id(parent))
        return False

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _special invocation category_."""
        if type(node) is not ast.Call:
            return ""
        if type(node.func) is ast.Name:
            return self._named_call_kind(node.func)
        if type(node.func) is ast.Subscript:
            return self._subscript_call_kind(node.func, node)
        if type(node.func) is not ast.Attribute:
            return ""
        return self._attribute_call_kind(node.func, node)
