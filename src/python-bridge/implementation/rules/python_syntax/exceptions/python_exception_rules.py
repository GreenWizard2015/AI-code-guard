from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_MULTI_EXCEPT_KIND

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
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

    def _exception_name(self, handler: ast.ExceptHandler) -> str:
        """Responsibilities: _exception name extraction_."""
        exception_type = handler.type
        if type(exception_type) is ast.Name:
            return exception_type.id
        if type(exception_type) is ast.Attribute:
            return exception_type.attr
        return ""

    def _operation_name(self, statement: ast.stmt) -> str:
        """Responsibilities: _direct exception-producing operation name_."""
        if type(statement) is not ast.Expr or type(statement.value) is not ast.Call:
            return ""
        function = statement.value.func
        if type(function) is ast.Name:
            return function.id
        if type(function) is ast.Attribute:
            return function.attr
        return ""

    def _idempotent_empty_handler(
        self, handler: ast.ExceptHandler, statement: ast.AST
    ) -> bool:
        """Responsibilities: _idempotent filesystem race suppression_."""
        if type(statement) not in (ast.Try, ast.TryStar) or len(statement.body) != 1:
            return False
        operation_name = self._operation_name(statement.body[0])
        exception_name = self._exception_name(handler)
        if exception_name == "FileNotFoundError":
            return operation_name in ("unlink", "remove")
        if exception_name == "FileExistsError":
            return operation_name == "mkdir"
        return False

    def _error_context_loss(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _Python explicit exception-context suppression_."""
        for node in ast.walk(handler):
            if type(node) is not ast.Raise:
                continue
            if node.cause is None:
                continue
            if self._explicit_none_cause(
                node.cause, self._prior_handler_assignments(handler, node)
            ):
                return [{"line": node.lineno - 1, "kind": "error-context-loss"}]
        return []

    def _target_names(self, target: ast.AST) -> list[str]:
        """Responsibilities: _simple assignment target names_."""
        if type(target) is ast.Name:
            return [target.id]
        if type(target) in (ast.Tuple, ast.List):
            return [name for item in target.elts for name in self._target_names(item)]
        return []

    def _record_statement_assignment(
        self, statement: ast.stmt, assignments: dict[str, ast.AST]
    ) -> None:
        """Responsibilities: _handler assignment extraction_."""
        if type(statement) is ast.Assign:
            self._record_assignment(statement.targets, statement.value, assignments)
            return
        if type(statement) is not ast.AnnAssign or statement.value is None:
            return
        self._record_assignment([statement.target], statement.value, assignments)

    def _prior_handler_assignments(
        self, handler: ast.ExceptHandler, raise_node: ast.Raise
    ) -> dict[str, ast.AST]:
        """Responsibilities: _preceding handler-local assignments_."""
        assignments: dict[str, ast.AST] = {}
        for statement in handler.body:
            if (statement.lineno, statement.col_offset) >= (
                raise_node.lineno,
                raise_node.col_offset,
            ):
                break
            self._record_statement_assignment(statement, assignments)
        return assignments

    def _record_assignment(
        self, targets: list[ast.AST], value: ast.AST, assignments: dict[str, ast.AST]
    ) -> None:
        """Responsibilities: _preceding handler value binding_."""
        for target in targets:
            for name in self._target_names(target):
                assignments[name] = value

    def _explicit_none_cause(
        self, cause: ast.AST, assignments: dict[str, ast.AST]
    ) -> bool:
        """Responsibilities: _exception cause lookup_."""
        seen: set[str] = set()
        while type(cause) is ast.Name and cause.id not in seen:
            seen.add(cause.id)
            cause = assignments.get(cause.id)
        return type(cause) is ast.Constant and cause.value is None

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

    def except_clause_issues(
        self, handler: ast.ExceptHandler, statement: ast.AST
    ) -> list[JsonObject]:
        """Responsibilities: _collection exception handler issues_."""
        issues: list[JsonObject] = []
        issues.extend(self._multi_except_issue(handler))
        self._append_broad_issue(issues, handler)
        if type(handler.type) is ast.Tuple and len(handler.type.elts) > 1:
            issues.append(
                {"line": handler.lineno - 1, "kind": PYTHON_MULTI_EXCEPT_KIND}
            )
        if self._empty_handler(handler):
            if not self._idempotent_empty_handler(handler, statement):
                issues.append(
                    {"line": handler.lineno - 1, "kind": "empty-error-handler"}
                )
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
            issues.extend(self.except_clause_issues(handler, node))
        return issues
