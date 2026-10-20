from __future__ import annotations

import ast

from implementation.types import JsonObject


class PythonDuplicateSetup:
    """Responsibilities: _duplicate setup recognition_, _test body issue reporting_."""

    def _assertion_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _test assertion statement_."""
        if type(statement) is ast.Assert:
            return True
        if type(statement) is not ast.Expr or type(statement.value) is not ast.Call:
            return False
        function = statement.value.func
        if type(function) is not ast.Attribute:
            return False
        return function.attr.startswith("assert")

    def _pair_issue(self, previous: ast.stmt, current: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _duplicate setup pair_."""
        previous_text = self._setup_key(previous)
        current_text = self._setup_key(current)
        if previous_text != current_text:
            return []
        return [{"line": current.lineno - 1, "kind": "test-duplicate-setup"}]

    def _setup_key(self, statement: ast.stmt) -> str:
        """Responsibilities: _runtime-equivalent assignment normalization_."""
        targets: list[ast.expr] = []
        value: ast.expr | None = None
        if type(statement) is ast.Assign:
            targets = statement.targets
            value = statement.value
        if type(statement) is ast.AnnAssign:
            targets = [statement.target]
            value = statement.value
        if not targets or value is None:
            return ast.dump(statement, include_attributes=False)
        target_keys = tuple(
            ast.dump(target, include_attributes=False) for target in targets
        )
        value_key = ast.dump(value, include_attributes=False)
        return repr((target_keys, value_key))

    def __init__(self) -> None:
        """Responsibilities: _duplicate setup rule initialization_."""

    def body_issues(self, statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _duplicate setup body_."""
        previous = statements[0]
        has_previous = not self._assertion_statement(previous)
        for statement in statements[1:]:
            if self._assertion_statement(statement):
                has_previous = False
                continue
            if has_previous:
                pair_issue = self._pair_issue(previous, statement)
                if pair_issue:
                    return pair_issue
            previous = statement
            has_previous = True
        return []

    def issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _duplicate setup issues_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        if not node.name.startswith("test_"):
            return []
        if not node.body:
            return []
        return self.body_issues(node.body)
