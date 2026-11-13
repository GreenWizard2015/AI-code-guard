from __future__ import annotations

import ast

from implementation.rules.call_analysis.python_callable_condition_alias_analysis import (
    PythonCallableConditionAliasAnalysis,
)


class PythonCallableConditionContext:
    """Responsibilities: _callable condition scope_, _test function context_."""

    def _parent_chain(self, leaf_node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _AST parent chain construction_."""
        parents: list[ast.AST] = []
        current = leaf_node
        while True:
            parent = self._parents.get(id(current))
            if parent is None:
                return parents
            parents.append(parent)
            current = parent

    def _callable_assignment_parent(self, parent: ast.AST) -> bool:
        """Responsibilities: _callable assignment scope_."""
        if type(parent) not in (ast.Assign, ast.AnnAssign):
            return False
        name = self._alias_analysis.condition_variable(parent)
        if not name:
            return False
        return self._alias_analysis.live_alias(parent)

    def _condition_parent(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _callable condition parent matching_."""
        for field_name, field_value in ast.iter_fields(parent):
            if field_name in ("test", "guard") and field_value is target:
                return True
            if field_name == "ifs" and type(parent) is ast.comprehension:
                if any(condition is target for condition in field_value):
                    return True
        return self._callable_assignment_parent(parent)

    def __init__(
        self,
        nodes: list[ast.AST],
        scopes: dict[ast.AST, str],
        parents: dict[int, ast.AST],
    ) -> None:
        """Responsibilities: _source scope index ownership_."""
        self._alias_analysis: PythonCallableConditionAliasAnalysis = PythonCallableConditionAliasAnalysis(nodes, scopes)
        self._parents: dict[int, ast.AST] = parents

    def contains_callable_condition(self, call_node: ast.Call) -> bool:
        """Responsibilities: _callable condition detection_."""
        target: ast.AST = call_node
        for parent in self._parent_chain(call_node):
            if self._condition_parent(parent, target):
                return True
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                return False
            target = parent
        return False

    def test_function(self, candidate_node: ast.AST) -> bool:
        """Responsibilities: _test function nesting_."""
        for parent in self._parent_chain(candidate_node):
            if type(parent) is ast.FunctionDef:
                return parent.name.startswith("test_")
            if type(parent) is ast.AsyncFunctionDef:
                return parent.name.startswith("test_")
            if type(parent) is ast.Lambda:
                return False
        return False
