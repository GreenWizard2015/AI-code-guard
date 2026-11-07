from __future__ import annotations

import ast
import unittest
from dataclasses import dataclass

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.context.python_reference_context_options import (
    PythonReferenceContextOptions,
)
from implementation.references.context.python_reference_symbol_tables import (
    PythonReferenceSymbolTables,
)
from implementation.references.python_reference_context import PythonReferenceContext


@dataclass(frozen=True)
class PythonReferenceScenario:
    """Responsibilities: _AST source_, _symbol ownership_."""

    tree: ast.Module
    node_index: PythonAstNodeIndex
    return_state: CallReturns
    context: PythonReferenceContext
    annotation_names: AnnotationNames


class PythonReferenceTestSupport:
    """Responsibilities: _reference scenario assembly_, _AST call selection_."""

    def __init__(self, test_case: unittest.TestCase) -> None:
        """Responsibilities: _test assertion owner assignment_."""
        self._test_case: unittest.TestCase = test_case

    def create_scenario(self, source: str) -> PythonReferenceScenario:
        """Responsibilities: _reference analysis scenario assembly_."""
        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases: dict[str, str] = {}
        instances: dict[str, str] = {}
        properties: dict[str, str] = {}
        annotation_names = AnnotationNames(node_index)
        return_state = CallReturns(annotation_names, node_index)
        options = PythonReferenceContextOptions(
            PythonReferenceSymbolTables(aliases, instances, properties, {}),
            return_state,
            node_index,
        )
        context = PythonReferenceContext(options)
        return PythonReferenceScenario(
            tree,
            node_index,
            return_state,
            context,
            annotation_names,
        )

    def call_expression(self, source: str) -> ast.Call:
        """Responsibilities: _call expression extraction_."""
        expression = ast.parse(source, mode="eval").body
        if type(expression) is not ast.Call:
            self._test_case.fail("Expected a call expression.")
        return expression

    def call_receiver(self, call: ast.Call) -> ast.expr:
        """Responsibilities: _method receiver extraction_."""
        if type(call.func) is not ast.Attribute:
            self._test_case.fail("Expected a method call.")
        return call.func.value

    def method_calls(self, tree: ast.AST) -> list[ast.Call]:
        """Responsibilities: _method call selection_."""
        calls: list[ast.Call] = []
        for node in ast.walk(tree):
            if type(node) is not ast.Call:
                continue
            if type(node.func) is not ast.Attribute:
                continue
            calls.append(node)
        return calls
