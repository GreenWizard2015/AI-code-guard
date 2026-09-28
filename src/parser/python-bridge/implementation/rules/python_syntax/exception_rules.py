from __future__ import annotations

import ast
from implementation.types import JsonObject
from implementation.rules.protocols import PythonExceptionAliasStateProtocol


class PythonExceptionRules:
    """Responsibilities: _classification Python exception handling_."""

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
        if type(exception_type) is ast.Name:
            if exception_type.id in self.aliases.multi_exception_names:
                return [{"line": handler.lineno - 1, "kind": "python-multi-except"}]
        if type(exception_type) is ast.Tuple:
            if self._handler_tuple_many(exception_type):
                return [{"line": handler.lineno - 1, "kind": "python-multi-except"}]
        return []

    def _handler_tuple_many(self, exception_type: ast.Tuple) -> bool:
        """Responsibilities: _multiple handler tuple values_."""
        if len(exception_type.elts) > 1:
            return True
        for item in exception_type.elts:
            if type(item) is not ast.Starred:
                continue
            if type(item.value) is not ast.Name:
                continue
            if item.value.id in self.aliases.multi_exception_names:
                return True
        return False

    def __init__(self, aliases: PythonExceptionAliasStateProtocol) -> None:
        """Responsibilities: _configuration exception names_."""
        self.aliases: PythonExceptionAliasStateProtocol = aliases

    def except_clause_issues(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _collection exception handler issues_."""
        issues: list[JsonObject] = []
        broad = handler.type is None
        if not broad:
            broad = self.aliases.broad(handler.type)
        issues.extend(self._multi_except_issue(handler))
        if broad:
            issues.append({"line": handler.lineno - 1, "kind": "broad-except"})
        if type(handler.type) is ast.Tuple:
            if len(handler.type.elts) > 1:
                issues.append({"line": handler.lineno - 1, "kind": "python-multi-except"})
        return issues

    def try_statement_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection try statement issues_."""
        self.aliases.observe(node)
        if type(node) not in (ast.Try, ast.TryStar):
            return []
        issues: list[JsonObject] = []
        for handler in node.handlers:
            issues.extend(self.except_clause_issues(handler))
        return issues
