from __future__ import annotations

import ast

from implementation.ast.protocols import PythonFunctionNodeContextContract
from implementation.rules.constants import PYTHON_RETURN_TYPE_KEY, PYTHON_STATEMENTS_KEY
from implementation.types import JsonObject, JsonValueList

PythonCallableNode = ast.FunctionDef | ast.AsyncFunctionDef


class PythonFunctionNodeRecord:
    """Responsibilities: _function AST ownership_, _callable metadata normalization_."""

    def _body_lines(self) -> int:
        """Responsibilities: _calculation callable body line_."""
        body = self._context.callable_statements.body_without_docstring(self._node.body)
        if not body:
            return 0
        first = body[0]
        last = body[-1]
        last_line = last.end_lineno
        if last_line is None:
            last_line = last.lineno
        return (last_line - first.lineno) + 1

    def _characters(self) -> int:
        """Responsibilities: _calculation significant callable characters_."""
        callable_statements = self._context.callable_statements
        body = callable_statements.body_without_docstring(self._node.body)
        source = ""
        if body:
            source = self._context.source_segments.segment(body[0])
        return max(1, self._context.source_segments.significant_characters(source))

    def _identity_metadata(self) -> JsonObject:
        """Responsibilities: _callable source identity_."""
        node = self._node
        return {
            "name": node.name,
            "owner": self._context.function_selector.owner_name(node),
            "start": node.lineno - 1,
            "end": (node.end_lineno or node.lineno) - 1,
        }

    def _body_metadata(self) -> JsonObject:
        """Responsibilities: _callable body metrics_, _exception behavior_."""
        body = self._context.callable_statements.body_without_docstring(self._node.body)
        return {
            "lines": self._body_lines(),
            "sloc": 1 + self._context.callable_metrics.statements_sloc(body),
            "control_flow_depth": self._context.callable_metrics.control_flow_depth(
                body,
            ),
            PYTHON_RETURN_TYPE_KEY: "",
            "exception_only": len(body) == 1 and type(body[0]) is ast.Raise,
        }

    def _callable_metadata(self) -> JsonObject:
        """Responsibilities: _callable AST metadata assembly_."""
        node = self._node
        data = self._identity_metadata()
        data.update(self._body_metadata())
        argument_context = self._context.callable_arguments.for_callable(node)
        data.update(argument_context.metadata(self._characters()))
        data["nested"] = self._context.function_selector.nested(node)
        return data

    def __init__(
        self,
        node: PythonCallableNode,
        context: PythonFunctionNodeContextContract,
    ) -> None:
        """Responsibilities: _function AST dependency ownership_."""
        self._node: PythonCallableNode = node
        self._context: PythonFunctionNodeContextContract = context

    def callable_metadata(self) -> JsonObject:
        """Responsibilities: _callable signature metadata_."""
        node = self._node
        data = self._callable_metadata()
        if node.returns is not None:
            data[PYTHON_RETURN_TYPE_KEY] = ast.unparse(node.returns)
        return data

    def body_data(self) -> JsonObject:
        """Responsibilities: _callable body data_."""
        node = self._node
        statements: JsonValueList = []
        callable_statements = self._context.callable_statements
        for item in callable_statements.body_without_docstring(node.body):
            statements.append(callable_statements.statement_node(item))
        body_data: JsonObject = {PYTHON_STATEMENTS_KEY: statements}
        body_data.update(self._context.test_assertion_data.collect(node, callable_statements))
        return body_data
