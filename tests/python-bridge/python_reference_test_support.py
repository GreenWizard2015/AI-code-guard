from __future__ import annotations

import ast
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


class PythonReferenceTestSupport(ast.NodeVisitor):
    """Responsibilities: _reference scenario assembly_, _AST call selection_."""

    def __init__(self) -> None:
        """Responsibilities: _AST traversal state_."""
        self._calls: list[ast.Call] = []
        self._attributes: list[ast.Attribute] = []
        self._functions: list[ast.FunctionDef] = []
        self._annotations: list[ast.expr] = []
        self._method_calls: list[ast.Call] = []
        self._pending_call: ast.Call | None = None

    def visit_Call(self, node: ast.Call) -> None:
        """Responsibilities: _call node traversal_."""
        self._calls.append(node)
        self._pending_call = node
        self.visit(node.func)
        self._pending_call = None
        for argument in node.args:
            self.visit(argument)
        for keyword in node.keywords:
            self.visit(keyword.value)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Responsibilities: _method call selection_."""
        self._attributes.append(node)
        if self._pending_call is not None:
            self._method_calls.append(self._pending_call)
            self._pending_call = None
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Responsibilities: _function declaration traversal_."""
        self._functions.append(node)
        self.generic_visit(node)

    def visit_arg(self, node: ast.arg) -> None:
        """Responsibilities: _argument annotation traversal_."""
        if node.annotation is not None:
            self._annotations.append(node.annotation)

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
        return ast.parse(source, mode="eval").body

    def call_receiver(self, call: ast.Call) -> ast.expr:
        """Responsibilities: _method receiver extraction_."""
        return call.func.value

    def method_calls(self, tree: ast.AST) -> list[ast.Call]:
        """Responsibilities: _method call selection_."""
        self._method_calls = []
        self._pending_call = None
        self.visit(tree)
        self._method_calls.sort(key=lambda call: (call.lineno, call.col_offset))
        return self._method_calls.copy()

    def call_nodes(self, tree: ast.AST) -> list[ast.Call]:
        """Responsibilities: _call node collection_."""
        self._calls = []
        self.visit(tree)
        self._calls.sort(key=lambda call: (call.lineno, call.col_offset))
        return self._calls.copy()

    def attribute_nodes(self, tree: ast.AST) -> list[ast.Attribute]:
        """Responsibilities: _attribute node collection_."""
        self._attributes = []
        self.visit(tree)
        self._attributes.sort(key=lambda attribute: (attribute.lineno, attribute.col_offset))
        return self._attributes.copy()

    def function_nodes(self, tree: ast.AST) -> list[ast.FunctionDef]:
        """Responsibilities: _function declaration collection_."""
        self._functions = []
        self.visit(tree)
        return self._functions.copy()

    def argument_annotations(self, tree: ast.AST) -> list[ast.expr]:
        """Responsibilities: _argument annotation collection_."""
        self._annotations = []
        self.visit(tree)
        return self._annotations.copy()
