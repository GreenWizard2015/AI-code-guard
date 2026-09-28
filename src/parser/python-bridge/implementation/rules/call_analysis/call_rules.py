from __future__ import annotations

from typing import Any
import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.rules.call_analysis.call_classification import (
    PythonCallClassification,
)
from implementation.rules.call_analysis.call_reflection import PythonCallReflection


class CallRules:
    """Responsibilities: _call rule ownership_."""

    def _configure(self) -> None:
        """Responsibilities: _call rule setup_."""
        self.reference_aliases.collect(self.tree)
        self.call_classification.configure(self.tree, self.node_index)
        self.call_reflection.configure(self.tree, self.node_index)

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _call rule setup_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.call_classification: PythonCallClassification = PythonCallClassification(
            self.reference_aliases
        )
        self.call_reflection: PythonCallReflection = PythonCallReflection()

    def assertion_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _bare assertion reporting_."""
        if type(node) is not ast.Assert:
            return []
        kind = "assertion-outside-test"
        if self.call_classification.test_function(node):
            kind = "assertion-in-test-function"
        return [
            {"line": node.lineno - 1, "kind": "python-test-assert-statement"},
            {"line": node.lineno - 1, "kind": kind},
        ]

    def collect_call_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _special invocation collection_."""
        kind = self.call_classification.kind(node)
        if kind:
            return [{"line": node.lineno - 1, "kind": kind}]
        return self.call_reflection.issues(node)

    def special_method_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _special method reporting_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            if node.name == "__call__":
                return [{"line": node.lineno - 1, "kind": "python-call-method"}]
        return []

    def temporary_instance_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _temporary invocation reporting_."""
        if not self.call_classification.temporary_constructor(node):
            return []
        return [{"line": node.lineno - 1, "kind": "temporary-instance-method-call"}]
