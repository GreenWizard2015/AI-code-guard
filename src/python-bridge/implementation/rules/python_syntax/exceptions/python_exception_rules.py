from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_MULTI_EXCEPT_KIND

from implementation.protocols import (
    PythonExceptionAliasStateContract,
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.types import JsonObject


class PythonExceptionRules:
    """Responsibilities: _handler validation_, _exception context reporting_."""

    def _multi_except_issue(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _multiple exception diagnostics_."""
        exception_type = handler.type
        if type(exception_type) is ast.Subscript:
            resolved = self.aliases.container_values.container_value(exception_type)
            if resolved.found():
                exception_type = resolved.expression_node()
        if exception_type is None:
            return []
        return self._exception_type_issue(handler, exception_type)

    def _exception_type_issue(
        self, handler: ast.ExceptHandler, exception_type: ast.AST
    ) -> list[JsonObject]:
        """Responsibilities: _exception type multiplicity diagnostics_."""
        if self.multiplicity.matches(exception_type):
            return [{"line": handler.lineno - 1, "kind": PYTHON_MULTI_EXCEPT_KIND}]
        return []

    def _empty_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _classification empty handler statements_."""
        if type(statement) is ast.Pass:
            return True
        if type(statement) is not ast.Expr:
            return False
        value = statement.value
        if type(value) is not ast.Constant:
            return False
        return type(value.value) is str

    def _empty_handler(self, handler: ast.ExceptHandler) -> bool:
        """Responsibilities: _empty exception handler detection_."""
        if not handler.body:
            return True
        return all(self._empty_statement(statement) for statement in handler.body)

    def _error_context_loss(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _Python explicit exception-context suppression_."""
        for node in ast.walk(handler):
            if type(node) is not ast.Raise:
                continue
            cause = node.cause
            if type(cause) is ast.Constant and cause.value is None:
                return [{"line": node.lineno - 1, "kind": "error-context-loss"}]
        return []

    def _append_broad_issue(
        self, issues: list[JsonObject], handler: ast.ExceptHandler
    ) -> bool:
        """Responsibilities: _broad exception diagnostics_."""
        broad = handler.type is None
        if not broad:
            broad = self.broadness.broad(handler.type)
        if broad:
            issues.append({"line": handler.lineno - 1, "kind": "broad-except"})
        return broad

    def __init__(
        self,
        aliases: PythonExceptionAliasStateContract,
        broadness: PythonExceptionBroadnessContract,
        multiplicity: PythonExceptionMultiplicityContract,
    ) -> None:
        """Responsibilities: _configuration exception names_."""
        self.aliases: PythonExceptionAliasStateContract = aliases
        self.broadness: PythonExceptionBroadnessContract = broadness
        self.multiplicity: PythonExceptionMultiplicityContract = multiplicity

    def except_clause_issues(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _collection exception handler issues_."""
        issues: list[JsonObject] = []
        issues.extend(self._multi_except_issue(handler))
        self._append_broad_issue(issues, handler)
        if type(handler.type) is ast.Tuple and len(handler.type.elts) > 1:
            issues.append(
                {"line": handler.lineno - 1, "kind": PYTHON_MULTI_EXCEPT_KIND}
            )
        if self._empty_handler(handler):
            issues.append({"line": handler.lineno - 1, "kind": "empty-error-handler"})
        issues.extend(self._error_context_loss(handler))
        return issues

    def try_statement_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection try statement issues_."""
        self.aliases.select(node)
        self.aliases.observe(node)
        if type(node) not in (ast.Try, ast.TryStar):
            return []
        issues: list[JsonObject] = []
        for handler in node.handlers:
            issues.extend(self.except_clause_issues(handler))
        return issues
