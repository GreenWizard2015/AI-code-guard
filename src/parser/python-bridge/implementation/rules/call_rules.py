from __future__ import annotations


from typing import Any
import ast

from implementation.rules.constants import REFLECTION_CALLS
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class CallRules:
    """Responsibilities: _classification Python invocation reflection_."""

    def _is_reflection_name(self, node: ast.Call) -> bool:
        """Responsibilities: _identification invocation configuration reflection_."""
        if type(node.func) is not ast.Name:
            return False
        return node.func.id in self.reflection_calls

    def _call_kind(self, node: ast.AST) -> str:
        """Responsibilities: _classification special assertion setattr_."""
        if type(node) is not ast.Call:
            return ""
        if type(node.func) is not ast.Attribute:
            return ""
        target: Any = node.func.value
        if type(target) is not ast.Name:
            return ""
        if target.id == "self" and node.func.attr.startswith("assert"):
            return self._assertion_call_kind(node)
        if node.func.attr == "__setattr__" and target.id == "object":
            return "python-object-setattr"
        if node.func.attr == "__init__":
            return "python-direct-class-init"
        return ""

    def _assertion_call_kind(self, node: ast.Call) -> str:
        """Responsibilities: _classification assertions they occur_."""
        if self.inside_test_function(node):
            return "assertion-in-test-function"
        return "assertion-outside-test"

    def _has_temporary_constructor(self, node: ast.AST) -> bool:
        """Responsibilities: _detection method access invocation_."""
        target: Any = ast.Constant(value=None)
        if type(node) is ast.Call and type(node.func) is ast.Attribute:
            target: Any = node.func.value
        if type(node) is ast.Attribute:
            target: Any = node.value
        if type(target) is not ast.Call or type(target.func) is not ast.Name:
            return False
        if not target.func.id[:1].isupper():
            return False
        return True

    def _reflection_rule_name(self, name: str) -> str:
        """Responsibilities: _Python-only reflection names mapping_."""
        if name in self.python_only_reflections:
            return f"python-{name}"
        return name

    def _callable_feature_detection(self, node: ast.Call) -> bool:
        """Responsibilities: _detection callable checks usage_."""
        parent: Any = self.parents.get(id(node))
        if type(parent) is ast.If and parent.test is node:
            return True
        if type(parent) is not ast.UnaryOp or type(parent.op) is not ast.Not:
            return False
        grandparent: Any = self.parents.get(id(parent))
        return type(grandparent) is ast.If and grandparent.test is parent

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization AST parents reflection_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.parents: Any = dict(
            (id(child), node)
            for node in self.node_index.nodes(tree)
            for child in ast.iter_child_nodes(node)
        )
        self.reflection_calls: Any = REFLECTION_CALLS
        self.python_only_reflections: Any = {"isinstance", "callable"}

    def inside_test_function(self, node: ast.AST) -> bool:
        """Responsibilities: _classification node nested inside_."""
        parent: Any = self.parents.get(id(node))
        while parent is not None:
            if type(parent) in (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
            ) and parent.name.startswith("test_"):
                return True
            parent: Any = self.parents.get(id(parent))
        return False

    def assertion_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting bare assertions their_."""
        if type(node) is not ast.Assert:
            return []
        kind: str = "assertion-outside-test"
        if self.inside_test_function(node):
            kind = "assertion-in-test-function"
        return [
            {"line": node.lineno - 1, "kind": "python-test-assert-statement"},
            {"line": node.lineno - 1, "kind": kind},
        ]

    def collect_call_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection special invocation diagnostics_."""
        kind: Any = self._call_kind(node)
        if kind:
            return [{"line": node.lineno - 1, "kind": kind}]
        if type(node) is not ast.Call or type(node.func) is not ast.Name:
            return []
        if self._is_reflection_name(node):
            if node.func.id == "callable" and not self._callable_feature_detection(
                node
            ):
                return []
            return [
                {
                    "line": node.lineno - 1,
                    "kind": self._reflection_rule_name(node.func.id),
                }
            ]
        return []

    def special_method_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting callable special methods_."""
        if (
            type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
            and node.name == "__call__"
        ):
            return [{"line": node.lineno - 1, "kind": "python-call-method"}]
        return []

    def temporary_instance_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting method invocation made_."""
        if not self._has_temporary_constructor(node):
            return []
        return [{"line": node.lineno - 1, "kind": "temporary-instance-method-call"}]
