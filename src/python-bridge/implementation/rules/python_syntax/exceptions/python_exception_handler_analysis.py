from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.references.protocols import (
    PythonContainerValuesContract,
    PythonExceptionAliasStateContract,
)
from implementation.rules.constants import PYTHON_BROAD_EXCEPT_RULE, PYTHON_MULTI_EXCEPT_KIND
from implementation.rules.protocols import PythonExceptionHandlerAssignmentsContract
from implementation.rules.python_syntax.exceptions.python_exception_handler_assignments import (
    PythonExceptionHandlerAssignments,
)
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonExceptionHandlerAnalysisOptions:
    """Responsibilities: _exception handler analysis inputs_."""

    handler: ast.ExceptHandler
    enclosing_statement: ast.AST
    aliases: PythonExceptionAliasStateContract
    broadness: PythonExceptionBroadnessContract
    multiplicity: PythonExceptionMultiplicityContract
    container_values: PythonContainerValuesContract


class PythonExceptionHandlerAnalysis:
    """Responsibilities: _handler validation_, _exception context reporting_."""

    _handler: ast.ExceptHandler
    _enclosing_statement: ast.AST
    _aliases: PythonExceptionAliasStateContract
    _broadness: PythonExceptionBroadnessContract
    _multiplicity: PythonExceptionMultiplicityContract
    _container_values: PythonContainerValuesContract

    def _multi_except_issue(self) -> list[JsonObject]:
        """Responsibilities: _multiple exception diagnostics_."""
        if not self._matches_multiple_exception():
            return []
        return [{"line": self._handler.lineno - 1, "kind": PYTHON_MULTI_EXCEPT_KIND}]

    def _matches_multiple_exception(self) -> bool:
        """Responsibilities: _multiple exception type detection_."""
        exception_type = self._handler.type
        if exception_type is None:
            return False
        match exception_type:
            case ast.Subscript():
                resolved = self._container_values.container_value(exception_type)
                if resolved.found():
                    resolved_type = resolved.expression_node()
                    match resolved_type:
                        case ast.expr():
                            exception_type = resolved_type
            case _:
                pass
        return self._multiplicity.matches(exception_type)

    def _empty_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _classification empty handler statements_."""
        match statement:
            case ast.Pass():
                return True
            case ast.Expr(value=ast.Constant(value=value)):
                return type(value) is str
            case _:
                return False

    def _empty_handler(self) -> bool:
        """Responsibilities: _empty exception handler detection_."""
        if not self._handler.body:
            return True
        return all(self._empty_statement(statement) for statement in self._handler.body)

    def _exception_name(self) -> str:
        """Responsibilities: _exception name extraction_."""
        match self._handler.type:
            case ast.Name(id=name):
                return name
            case ast.Attribute(attr=name):
                return name
            case _:
                return ""

    def _operation_name(self, operation: ast.Expr) -> str:
        """Responsibilities: _direct exception-producing operation name_."""
        match operation.value:
            case ast.Call(func=ast.Name(id=name)):
                return name
            case ast.Call(func=ast.Attribute(attr=name)):
                return name
            case _:
                return ""

    def _idempotent_empty_handler(self) -> bool:
        """Responsibilities: _idempotent filesystem race suppression_."""
        match self._enclosing_statement:
            case ast.Try(body=[operation]) | ast.TryStar(body=[operation]):
                pass
            case _:
                return False
        if type(operation) is not ast.Expr:
            return False
        operation_name = self._operation_name(operation)
        exception_name = self._exception_name()
        if exception_name == "FileNotFoundError":
            return operation_name in ("unlink", "remove")
        if exception_name == "FileExistsError":
            return operation_name == "mkdir"
        return False

    def _prior_handler_assignments(
        self,
        raise_node: ast.Raise,
    ) -> PythonExceptionHandlerAssignmentsContract:
        """Responsibilities: _preceding handler-local assignments_."""
        assignments = PythonExceptionHandlerAssignments()
        for statement in self._handler.body:
            if (statement.lineno, statement.col_offset) >= (
                raise_node.lineno,
                raise_node.col_offset,
            ):
                break
            assignments.record_statement(statement)
        return assignments

    def _bound_error_used(self) -> bool:
        """Responsibilities: _bound exception usage_."""
        exception_name = self._handler.name
        if exception_name is None:
            return False
        for statement in self._handler.body:
            for node in ast.walk(statement):
                if type(node) is not ast.Name:
                    continue
                if node.id != exception_name:
                    continue
                if type(node.ctx) is not ast.Load:
                    continue
                return True
        return False

    def _broad_issue(self) -> bool:
        """Responsibilities: _broad exception diagnostics_."""
        if self._bound_error_used():
            return False
        exception_type = self._handler.type
        if exception_type is None:
            return True
        return self._broadness.broad(exception_type)

    def _append_type_issues(self, issues: list[JsonObject]) -> None:
        """Responsibilities: _exception type diagnostics_."""
        if self._broad_issue():
            issues.append({"line": self._handler.lineno - 1, "kind": PYTHON_BROAD_EXCEPT_RULE})
        match self._handler.type:
            case ast.Tuple(elts=[_, _, *_]):
                issues.append(
                    {
                        "line": self._handler.lineno - 1,
                        "kind": PYTHON_MULTI_EXCEPT_KIND,
                    },
                )

    def _append_empty_issue(self, issues: list[JsonObject]) -> None:
        """Responsibilities: _empty handler issue recording_."""
        if not self._empty_handler():
            return
        if self._idempotent_empty_handler():
            return
        issues.append({"line": self._handler.lineno - 1, "kind": "empty-error-handler"})

    def __init__(self, options: PythonExceptionHandlerAnalysisOptions) -> None:
        """Responsibilities: _exception handler context ownership_."""
        self._handler = options.handler
        self._enclosing_statement = options.enclosing_statement
        self._aliases = options.aliases
        self._broadness = options.broadness
        self._multiplicity = options.multiplicity
        self._container_values = options.container_values

    def context_issues(self) -> list[JsonObject]:
        """Responsibilities: _Python explicit exception-context suppression_."""
        for node in ast.walk(self._handler):
            match node:
                case ast.Raise(cause=cause) if cause is not None:
                    assignments = self._prior_handler_assignments(node)
                    if assignments.explicit_none_cause(cause):
                        return [{"line": node.lineno - 1, "kind": "error-context-loss"}]
        return []

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _handler classification diagnostics_."""
        issues = self._multi_except_issue()
        self._append_type_issues(issues)
        self._append_empty_issue(issues)
        return issues
