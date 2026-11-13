from __future__ import annotations

import ast

from implementation.rules.call_analysis.python_name_access import PythonNameAccess


class PythonCallableConditionAliasAnalysis:
    """Responsibilities: _condition alias tracking_, _alias reassignment detection_."""

    def _assignment_precedes(self, first: ast.AST, second: ast.AST) -> bool:
        """Responsibilities: _same-scope statement order_."""
        match first:
            case ast.expr(lineno=first_line, col_offset=first_column) | ast.stmt(
                lineno=first_line,
                col_offset=first_column,
            ):
                pass
            case _:
                return False
        match second:
            case ast.expr(lineno=second_line, col_offset=second_column) | ast.stmt(
                lineno=second_line,
                col_offset=second_column,
            ):
                pass
            case _:
                return False
        return (first_line, first_column) < (second_line, second_column)

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
        target_condition: ast.expr,
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
        for expression in expressions:
            access = PythonNameAccess(expression, alias_name)
            if not access.reads():
                continue
            if not self._assignment_precedes(alias_assignment, expression):
                continue
            if not self._reassigned_before(alias_assignment, expression, alias_name):
                return True
        return False

    def __init__(self, nodes: list[ast.AST], scopes: dict[ast.AST, str]) -> None:
        """Responsibilities: _condition alias source index_."""
        self._nodes: list[ast.AST] = nodes
        self._scopes: dict[ast.AST, str] = scopes

    def condition_variable(self, assignment: ast.AST) -> str:
        """Responsibilities: _condition assignment target_."""
        if type(assignment) is ast.Assign:
            if len(assignment.targets) == 1 and type(assignment.targets[0]) is ast.Name:
                return assignment.targets[0].id
        if type(assignment) is ast.AnnAssign and type(assignment.target) is ast.Name:
            return assignment.target.id
        return ""

    def live_alias(self, alias_assignment: ast.AST) -> bool:
        """Responsibilities: _live alias matching_."""
        alias_name = self.condition_variable(alias_assignment)
        if not alias_name:
            return False
        scope = self._scopes.get(alias_assignment)
        if scope is None:
            return False
        for condition in self._nodes:
            if self._condition_preserves_alias(alias_assignment, condition, alias_name):
                return True
        return False
