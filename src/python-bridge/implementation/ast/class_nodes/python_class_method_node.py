from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableArgumentsContract,
    PythonCallableMetricsContract,
    PythonCallableStatementsContract,
    PythonClassNodeOptionsContract,
    PythonSourceSegmentsContract,
    PythonTestAssertionAliasesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.references.test_assertions.assertion_aliases import (
    PythonTestAssertionAliases,
    PythonTestAssertionAliasOptions,
)
from implementation.references.test_assertions.python_callable_test_assertions import (
    PythonCallableTestAssertions,
)
from implementation.rules.constants import PYTHON_RETURN_TYPE_KEY, PYTHON_STATEMENTS_KEY
from implementation.types import JsonObject, JsonValueList

PythonMethodNode = ast.FunctionDef | ast.AsyncFunctionDef


@dataclass(frozen=True)
class PythonClassNodeOptions:
    """Responsibilities: _class normalization inputs_."""

    node: ast.ClassDef
    source: str
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    type_aliases: PythonScopedTypeAliasesContract
    module_body: list[ast.stmt]


class PythonClassMethodNode:
    """Responsibilities: _class method AST ownership_, _method metadata normalization_."""

    def _assertion_aliases(self) -> PythonTestAssertionAliasesContract:
        """Responsibilities: _method assertion alias setup_."""
        node_index = self._options.node_index
        container_aliases = self._options.container_aliases
        container_values = container_aliases.container_values()
        return PythonTestAssertionAliases(
            PythonTestAssertionAliasOptions(
                self._node,
                node_index,
                container_aliases,
                container_aliases.container_keys(),
                container_values,
                PythonReferenceAliases(PythonReferenceAliasState()),
            ),
        )

    def __init__(
        self,
        node: PythonMethodNode,
        options: PythonClassNodeOptionsContract,
    ) -> None:
        """Responsibilities: _method metadata state_."""
        self._node: PythonMethodNode = node
        self._options: PythonClassNodeOptionsContract = options
        self._callable_arguments: PythonCallableArgumentsContract = CallableArguments(
            options.node_index,
            options.type_aliases,
        )
        self._callable_metrics: PythonCallableMetricsContract = CallableMetrics(options.node_index)
        self._callable_statements: PythonCallableStatementsContract = CallableStatements()

    def body_lines(self) -> int:
        """Responsibilities: _method body line count_."""
        body = self._callable_statements.body_without_docstring(self._node.body)
        if not body:
            return 0
        first = body[0]
        last = body[-1]
        last_line = last.end_lineno
        if last_line is None:
            last_line = last.lineno
        return (last_line - first.lineno) + 1

    def characters(self) -> int:
        """Responsibilities: _method significant character count_."""
        body = self._callable_statements.body_without_docstring(self._node.body)
        source = ""
        if body:
            source = self._options.source_segments.segment(body[0])
        return max(1, self._options.source_segments.significant_characters(source))

    def metadata(self) -> JsonObject:
        """Responsibilities: _method identity and metrics_."""
        node = self._node
        argument_context = self._callable_arguments.for_callable(node)
        body = self._callable_statements.body_without_docstring(node.body)
        data: JsonObject = {
            "name": node.name,
            "start": node.lineno - 1,
            "end": (node.end_lineno or node.lineno) - 1,
            "lines": self.body_lines(),
            "sloc": 1 + self._callable_metrics.statements_sloc(body),
            "control_flow_depth": self._callable_metrics.control_flow_depth(body),
            PYTHON_RETURN_TYPE_KEY: "",
            "exception_only": len(body) == 1 and type(body[0]) is ast.Raise,
            "owner": self._options.node.name,
            "nested": False,
        }
        data.update(argument_context.metadata(self.characters()))
        return data

    def statements(self) -> JsonValueList:
        """Responsibilities: _method statement normalization_."""
        statements: JsonValueList = []
        for item in self._callable_statements.body_without_docstring(self._node.body):
            statements.append(self._callable_statements.statement_node(item))
        return statements

    def assertions(self) -> JsonObject:
        """Responsibilities: _method assertion metadata_."""
        node_index = self._options.node_index
        assertion_aliases = self._assertion_aliases()
        assertions = PythonCallableTestAssertions(
            self._node,
            node_index,
            assertion_aliases,
        )
        return {
            "has_unittest_assertion": assertions.unittest_assertion_present(),
            "unittest_assertion_alias": assertions.assertion_aliases().assertion_alias_present(),
            "unittest_exception_only": assertions.exception_only_assertion(),
            "test_exception_bypass": assertions.exception_bypass(),
            "unittest_ending_valid": assertions.valid_assertion_ending(
                self._callable_statements,
            ),
            "unittest_assertion_count": assertions.assertion_count(
                self._callable_statements,
            ),
        }

    def result(self) -> JsonObject:
        """Responsibilities: _method node normalization_."""
        data = self.metadata()
        if self._node.returns is not None:
            data[PYTHON_RETURN_TYPE_KEY] = ast.unparse(self._node.returns)
        data[PYTHON_STATEMENTS_KEY] = self.statements()
        data.update(self.assertions())
        return data
