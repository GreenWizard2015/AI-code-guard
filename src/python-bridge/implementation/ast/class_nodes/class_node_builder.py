from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property
from typing import Any

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.class_nodes.python_class_node_details import (
    PythonClassNodeDetails,
)
from implementation.ast.class_nodes.python_class_node_fields import (
    PythonClassNodeFields,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.ast.protocols import (
    PythonCallableArgumentsContract,
    PythonCallableMetricsContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.test_assertions.assertion_aliases import (
    PythonTestAssertionAliases,
    PythonTestAssertionAliasesOptions,
)
from implementation.references.test_assertions.python_callable_test_assertions import (
    PythonCallableTestAssertions,
)
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_RETURN_TYPE_KEY, PYTHON_STATEMENTS_KEY


@dataclass(frozen=True)
class PythonClassNodeOptions:
    """Responsibilities: _class node construction inputs_."""

    node: ast.ClassDef
    source: str
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    type_aliases: PythonScopedTypeAliasesContract
    module_body: list[ast.stmt]


class PythonClassNode:
    """Responsibilities: _Python class nodes normalization_, _method metadata collection_."""

    result: JsonObject

    def _body_lines(self, node: ast.AST) -> int:
        """Responsibilities: _calculation method body lines_."""
        body: Any = self.callable_statements.body_without_docstring(node.body)
        if not body:
            return 0
        first: Any = body[0]
        last: Any = body[-1]
        last_line: Any = last.end_lineno
        if last_line is None:
            last_line = last.lineno
        return (last_line - first.lineno) + 1

    def _characters(self, node: ast.AST) -> int:
        """Responsibilities: _calculation significant method characters_."""
        body: Any = self.callable_statements.body_without_docstring(node.body)
        source = ""
        if body:
            source = self.source_segments.segment(body[0])
        return max(1, self.source_segments.significant_characters(source))

    def _method_metadata(
        self,
        node: ast.AST,
        callable_arguments: PythonCallableArgumentsContract,
        callable_metrics: PythonCallableMetricsContract,
    ) -> JsonObject:
        """Responsibilities: _method identity metrics arguments_."""
        arguments: Any = callable_arguments.callable_arguments(node)
        body: Any = self.callable_statements.body_without_docstring(node.body)
        data: dict[str, Any] = {
            "name": node.name,
            "start": node.lineno - 1,
            "end": (node.end_lineno or node.lineno) - 1,
            "lines": self._body_lines(node),
            "sloc": 1 + callable_metrics.statements_sloc(body),
            "control_flow_depth": callable_metrics.control_flow_depth(body),
            PYTHON_RETURN_TYPE_KEY: "",
            "exception_only": len(body) == 1 and type(body[0]) is ast.Raise,
        }
        data.update(
            callable_arguments.argument_metadata(
                node, arguments, self._characters(node)
            )
        )
        data["owner"] = self.node.name
        data["nested"] = False
        return data

    def _method_statements(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _method statement normalization_."""
        statements: list[JsonObject] = []
        for item in self.callable_statements.body_without_docstring(node.body):
            statements.append(self.callable_statements.statement_node(item))
        return statements

    def _method_assertions(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _method assertion metadata_."""
        assertion_aliases = PythonTestAssertionAliases(
            PythonTestAssertionAliasesOptions(
                node,
                self.node_index,
                self.container_aliases,
                self.container_aliases.container_keys,
                PythonReferenceAliases(),
            )
        )
        assertions = PythonCallableTestAssertions(
            node, self.node_index, assertion_aliases
        )
        return {
            "has_unittest_assertion": assertions.unittest_assertion_present(),
            "unittest_assertion_alias": assertions.assertion_aliases.assertion_alias_present(),
            "unittest_exception_only": assertions.exception_only_assertion(),
            "test_exception_bypass": assertions.exception_bypass(),
            "unittest_ending_valid": assertions.valid_assertion_ending(
                self.callable_statements
            ),
            "unittest_assertion_count": assertions.assertion_count(
                self.callable_statements
            ),
        }

    def _method_node(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _method node normalization_."""
        callable_arguments: PythonCallableArgumentsContract = CallableArguments(
            self.node_index, self.type_aliases
        )
        callable_metrics: PythonCallableMetricsContract = CallableMetrics()
        data: Any = self._method_metadata(node, callable_arguments, callable_metrics)
        if node.returns is not None:
            data[PYTHON_RETURN_TYPE_KEY] = ast.unparse(node.returns)
        data[PYTHON_STATEMENTS_KEY] = self._method_statements(node)
        data.update(self._method_assertions(node))
        return data

    def _method_candidates(self) -> list[ast.stmt]:
        """Responsibilities: _class method candidates collection_."""
        candidates: list[ast.stmt] = []
        for item in self.node.body:
            if type(item) in (ast.FunctionDef, ast.AsyncFunctionDef):
                candidates.append(item)
        return candidates

    def __init__(self, options: PythonClassNodeOptions) -> None:
        """Responsibilities: _class source metadata initialization_."""
        self.node: Any = options.node
        self.source: Any = options.source
        self.node_index: Any = options.node_index
        self.source_segments: PythonSourceSegmentsContract = options.source_segments
        self.callable_statements: Any = CallableStatements()
        self.container_aliases: PythonContainerAliasesContract = (
            options.container_aliases
        )
        self.type_aliases: PythonScopedTypeAliasesContract = options.type_aliases
        self.details: Any = PythonClassNodeDetails(
            options.node,
            options.node_index,
            self.callable_statements,
            PythonClassNodeFields(
                options.node,
                options.container_aliases,
                options.node_index,
                options.module_body,
            ),
        )

    @cached_property
    def result(self) -> JsonObject:
        """Responsibilities: _class metadata construction_."""
        metadata: Any = self.details.metadata(self.method_nodes)
        return {
            **metadata,
            "methods": self.method_nodes,
            "fields": self.details.field_details.fields(),
            "untyped_fields": self.details.field_details.untyped_fields(),
            "callback_fields": 0,
            "inline_callback_fields": 0,
            "dependencies": self.details.dependencies(),
        }

    @cached_property
    def method_nodes(self) -> list[dict]:
        """Responsibilities: _method node serialization_."""
        methods: Any = []
        for item in self._method_candidates():
            methods.append(self._method_node(item))
        return methods
