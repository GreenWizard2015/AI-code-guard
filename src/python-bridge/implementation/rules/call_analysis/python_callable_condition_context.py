from __future__ import annotations

import ast

from implementation.rules.call_analysis.python_name_access import PythonNameAccess


class PythonCallableConditionContext:
    """Responsibilities: _callable condition scope_, _test function context_."""

    def _condition_variable(self, assignment: ast.AST) -> str:
        """Responsibilities: _condition assignment target_."""
        if type(assignment) is ast.Assign:
            if len(assignment.targets) == 1 and type(assignment.targets[0]) is ast.Name:
                return assignment.targets[0].id
        if type(assignment) is ast.AnnAssign and type(assignment.target) is ast.Name:
            return assignment.target.id
        return ""

    def _assignment_precedes(self, first: ast.AST, second: ast.AST) -> bool:
        """Responsibilities: _same-scope statement order_."""
        if first.lineno < second.lineno:
            return True
        if first.lineno > second.lineno:
            return False
        return first.col_offset < second.col_offset

    def _assignment_targets(self, candidate: ast.AST) -> list[ast.expr]:
        """Responsibilities: _assignment target extraction_."""
        if type(candidate) is ast.Assign:
            return candidate.targets
        if type(candidate) is ast.AnnAssign:
            return [candidate.target]
        if type(candidate) is ast.AugAssign:
            return [candidate.target]
        if type(candidate) is ast.NamedExpr:
            return [candidate.target]
        if type(candidate) is ast.For:
            return [candidate.target]
        if type(candidate) is ast.AsyncFor:
            return [candidate.target]
        return []

    def _condition_expressions(self, condition: ast.AST) -> list[ast.expr]:
        """Responsibilities: _conditional expression selection_."""
        for field_name, field_value in ast.iter_fields(condition):
            if field_name == "test":
                return [field_value]
            if field_name == "guard" and field_value is not None:
                return [field_value]
            if field_name == "ifs":
                return list(field_value)
        return []

    def _reassigned_before(
        self,
        initial_assignment: ast.AST,
        target_condition: ast.AST,
        tracked_name: str,
    ) -> bool:
        """Responsibilities: _condition alias reassignment detection_."""
        for candidate in self._nodes:
            if candidate is initial_assignment:
                continue
            if self._scopes.get(candidate) != self._scopes.get(target_condition):
                continue
            if not self._tracked_name_match(candidate, tracked_name):
                continue
            if not self._assignment_precedes(initial_assignment, candidate):
                continue
            if self._assignment_precedes(candidate, target_condition):
                return True
        return False

    def _tracked_name_match(self, candidate: ast.AST, tracked_name: str) -> bool:
        """Responsibilities: _alias target lookup_."""
        targets = self._assignment_targets(candidate)
        for target in targets:
            name_access = PythonNameAccess(target, tracked_name)
            if name_access.writes():
                return True
        return False

    def _live_condition_alias(self, alias_assignment: ast.AST) -> bool:
        """Responsibilities: _live alias matching_."""
        alias_name = self._condition_variable(alias_assignment)
        if not alias_name:
            return False
        scope = self._scopes.get(alias_assignment)
        if scope is None:
            return False
        for condition in self._nodes:
            if self._condition_preserves_alias(alias_assignment, condition, alias_name):
                return True
        return False

    def _condition_preserves_alias(
        self,
        alias_assignment: ast.AST,
        candidate_condition: ast.AST,
        alias_name: str,
    ) -> bool:
        """Responsibilities: _live condition alias verification_."""
        scope = self._scopes.get(candidate_condition)
        if scope is None:
            return False
        expressions = self._condition_expressions(candidate_condition)
        name_accesses = [PythonNameAccess(expression, alias_name) for expression in expressions]
        if not any(name_access.reads() for name_access in name_accesses):
            return False
        if not self._assignment_precedes(alias_assignment, candidate_condition):
            return False
        return not self._reassigned_before(
            alias_assignment,
            candidate_condition,
            alias_name,
        )

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
        name = self._condition_variable(parent)
        if not name:
            return False
        return self._live_condition_alias(parent)

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
        self._nodes: list[ast.AST] = nodes
        self._scopes: dict[ast.AST, str] = scopes
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
