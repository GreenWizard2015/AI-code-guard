from __future__ import annotations

import ast
from collections import Counter

from implementation.rules.constants import PYTHON_TEST_ASSERTION_PREFIX
from implementation.types import JsonObject, PythonNameAccessKey


class PythonTestIssueStages:
    """Responsibilities: _test assertion analysis_, _inline object policy_."""

    _assertion_prefix: str

    def _assertion_statement(self, assertion_candidate: ast.stmt) -> bool:
        """Responsibilities: _test assertion statement_."""
        if type(assertion_candidate) is ast.Assert:
            return True
        if type(assertion_candidate) is not ast.Expr or type(assertion_candidate.value) is not ast.Call:
            return False
        function = assertion_candidate.value.func
        if type(function) is not ast.Attribute:
            return False
        return function.attr.startswith(self._assertion_prefix)

    def _setup_key(self, setup_candidate: ast.stmt) -> str:
        """Responsibilities: _setup statement identity_."""
        targets: list[ast.expr] = []
        value: ast.expr | None = None
        if type(setup_candidate) is ast.Assign:
            targets = setup_candidate.targets
            value = setup_candidate.value
        else:
            if type(setup_candidate) is ast.AnnAssign:
                targets = [setup_candidate.target]
                value = setup_candidate.value
        if not targets or value is None:
            return ast.dump(setup_candidate, include_attributes=False)
        target_keys = tuple(ast.dump(target, include_attributes=False) for target in targets)
        value_key = ast.dump(value, include_attributes=False)
        return repr((target_keys, value_key))

    def _duplicate_setup_pair(self, previous: ast.stmt, current: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _duplicate setup pair_."""
        if self._setup_key(previous) != self._setup_key(current):
            return []
        return [{"line": current.lineno - 1, "kind": "test-duplicate-setup"}]

    def _object_assignment(self, assignment_candidate: ast.stmt) -> str:
        """Responsibilities: _object literal assignment name_."""
        if type(assignment_candidate) is ast.Assign:
            if len(assignment_candidate.targets) != 1:
                return ""
            target = assignment_candidate.targets[0]
            value = assignment_candidate.value
        else:
            if type(assignment_candidate) is not ast.AnnAssign:
                return ""
            target = assignment_candidate.target
            value = assignment_candidate.value
        if type(target) is not ast.Name or type(value) is not ast.Dict:
            return ""
        return target.id

    def _equality_names(self, equality_candidate: ast.stmt) -> list[str]:
        """Responsibilities: _equality assertion names_."""
        if type(equality_candidate) is not ast.Expr or type(equality_candidate.value) is not ast.Call:
            return []
        call = equality_candidate.value
        if type(call.func) is not ast.Attribute:
            return []
        if call.func.attr not in {"assertEqual", "assertDictEqual"} or len(call.args) < 2:
            return []
        actual = call.args[0]
        expected = call.args[1]
        if type(actual) is not ast.Name or type(expected) is not ast.Name:
            return []
        if actual.id == expected.id:
            return []
        return [actual.id, expected.id]

    def _object_assignments(self, assignment_statements: list[ast.stmt]) -> dict[str, int]:
        """Responsibilities: _object literal assignment locations_."""
        assignments: dict[str, int] = {}
        for assignment in assignment_statements:
            name = self._object_assignment(assignment)
            if name:
                assignments[name] = assignment.lineno
        return assignments

    def _name_access_counts(self, body_statements: list[ast.stmt]) -> Counter[PythonNameAccessKey]:
        """Responsibilities: _name access counts_."""
        counts: Counter[PythonNameAccessKey] = Counter()
        for statement in body_statements:
            for candidate in ast.walk(statement):
                if type(candidate) is not ast.Name:
                    continue
                access = "read" if type(candidate.ctx) is ast.Load else "write"
                counts[(candidate.id, access)] += 1
        return counts

    def _inline_assertion_line(
        self,
        assertion_candidate: ast.stmt,
        assignments: dict[str, int],
        access_counts: Counter[PythonNameAccessKey],
    ) -> int:
        """Responsibilities: _disposable object assertion line_."""
        for name in self._equality_names(assertion_candidate):
            assignment_line = assignments.get(name, assertion_candidate.lineno)
            if assignment_line >= assertion_candidate.lineno:
                continue
            if access_counts[(name, "read")] != 1:
                continue
            if access_counts[(name, "write")] != 1:
                continue
            return assertion_candidate.lineno - 1
        return -1

    def __init__(self) -> None:
        """Responsibilities: _test assertion vocabulary_."""
        self._assertion_prefix = PYTHON_TEST_ASSERTION_PREFIX

    def duplicate_setup(self, test_statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _duplicate setup statements_."""
        previous: ast.stmt | None = None
        for statement in test_statements:
            if self._assertion_statement(statement):
                previous = None
                continue
            if previous is not None:
                issue = self._duplicate_setup_pair(previous, statement)
                if issue:
                    return issue
            previous = statement
        return []

    def inline_object_literals(self, assertion_statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _inline equality object literals_."""
        assignments = self._object_assignments(assertion_statements)
        access_counts = self._name_access_counts(assertion_statements)
        for assertion in assertion_statements:
            line = self._inline_assertion_line(assertion, assignments, access_counts)
            if line >= 0:
                return [{"line": line, "kind": "inline-assertion-object-literals"}]
        return []

    def test_body_issues(self, body: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _test body diagnostics_."""
        issues = self.duplicate_setup(body)
        issues.extend(self.inline_object_literals(body))
        return issues
