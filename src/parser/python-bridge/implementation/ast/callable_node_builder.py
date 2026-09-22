from __future__ import annotations


from typing import Any
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_metrics import CallableMetrics
from implementation.ast.callable_statements import CallableStatements
from implementation.references.callable_test_assertions import (
    PythonCallableTestAssertions,
)
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.ast.source_segments import SourceSegments
from implementation.types import JsonObject
import ast


class PythonCallableNode:
    """Responsibilities: _construction normalization Python callable_."""

    def _callable_data(
        self,
        callable_statements: CallableStatements,
        callable_arguments: CallableArguments,
        callable_metrics: CallableMetrics,
    ) -> JsonObject:
        """Responsibilities: _identity metrics arguments assembly_."""
        arguments: Any = callable_arguments.callable_arguments(self.node)
        body: Any = callable_statements.body_without_docstring(self.node.body)
        data: dict[str, Any] = {
            "name": self.node.name,
            "start": self.node.lineno - 1,
            "end": (self.node.end_lineno or self.node.lineno) - 1,
            "lines": self._body_lines(callable_statements),
            "sloc": 1 + callable_metrics.statements_sloc(body),
            "return_type": "",
            "exception_only": len(body) == 1 and type(body[0]) is ast.Raise,
        }
        data.update(
            callable_arguments.argument_metadata(
                self.node, arguments, self._characters(callable_statements)
            )
        )
        if self.owner:
            data["owner"] = self.owner
        return data

    def _body_lines(self, callable_statements: CallableStatements) -> int:
        """Responsibilities: _calculation callable body line_."""
        body: Any = callable_statements.body_without_docstring(self.node.body)
        if not body:
            return 0
        first: Any = body[0]
        last: Any = body[-1]
        first_line: Any = first.lineno
        last_line: Any = last.end_lineno
        if last_line is None:
            last_line: Any = last.lineno
        line_count = last_line - first_line
        return line_count + 1

    def _characters(self, callable_statements: CallableStatements) -> int:
        """Responsibilities: _calculation significant characters callable_."""
        body: Any = ""
        callable_body: Any = callable_statements.body_without_docstring(self.node.body)
        if callable_body:
            source_segment: Any = self.source_segments.segment(callable_body[0])
            if source_segment:
                body: Any = source_segment
        characters: Any = self.source_segments.significant_characters(body)
        return max(1, characters)

    def _test_data(self, callable_statements: CallableStatements) -> JsonObject:
        """Responsibilities: _collection assertion test-ending metadata_."""
        return {
            "has_unittest_assertion": self.test_assertions.unittest_assertion_present(),
            "unittest_exception_only": self.test_assertions.exception_only_assertion(),
            "test_exception_bypass": self.test_assertions.exception_bypass(),
            "unittest_ending_valid": self.test_assertions.valid_assertion_ending(
                callable_statements
            ),
            "unittest_assertion_count": self.test_assertions.assertion_count(
                callable_statements
            ),
        }

    def __init__(
        self,
        node: ast.AST,
        node_index: PythonAstNodeIndexProtocol,
        source_segments: SourceSegments,
        owner: str = "",
    ) -> None:
        """Responsibilities: _initialization callable AST source_."""
        self.node: Any = node
        self.owner: Any = owner
        self.node_index: Any = node_index
        self.source_segments: Any = source_segments
        self.test_assertions: PythonCallableTestAssertions = (
            PythonCallableTestAssertions(node, node_index)
        )

    def statements(self, callable_statements: CallableStatements) -> list[JsonObject]:
        """Responsibilities: _normalization statements callable body_."""
        statements: list[dict[str, Any]] = []
        for item in callable_statements.body_without_docstring(self.node.body):
            statements.append(callable_statements.statement_node(item))
        return statements

    def result(
        self,
        callable_statements: CallableStatements,
        callable_arguments: CallableArguments,
        callable_metrics: CallableMetrics,
    ) -> JsonObject:
        """Responsibilities: _construction complete normalization callable_."""
        data: Any = self._callable_data(
            callable_statements, callable_arguments, callable_metrics
        )
        if self.node.returns is not None:
            data["return_type"] = ast.unparse(self.node.returns)
        data["statements"] = self.statements(callable_statements)
        data.update(self._test_data(callable_statements))
        return data
