from __future__ import annotations

import ast
from collections import deque

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import PythonTupleTypeNamesContract
from implementation.rules.constants import (
    PYTHON_INLINE_GENERIC_TYPE_RULE,
    PYTHON_TUPLE_TYPE_RULE,
)
from implementation.types import JsonObject, PythonCallableAstNode


class PythonDeclaredAnnotationIssues:
    """Responsibilities: _declared annotation constraints_, _nested generic type validation_."""

    _tuple_type_names: PythonTupleTypeNamesContract
    _node_index: PythonAstNodeIndexContract

    def _annotations(self, declaration: ast.AST) -> list[ast.expr]:
        """Responsibilities: _declaration annotation extraction_."""
        match declaration:
            case ast.arg(annotation=ast.expr() as annotation) | ast.AnnAssign(
                annotation=ast.expr() as annotation,
            ) if type(declaration) in (ast.arg, ast.AnnAssign):
                return [annotation]
            case ast.FunctionDef(returns=ast.expr() as annotation) | ast.AsyncFunctionDef(
                returns=ast.expr() as annotation,
            ) if type(declaration) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return [annotation]
            case _:
                return []

    def _contains_string_literal(self, annotation: ast.expr) -> bool:
        """Responsibilities: _nested annotation string detection_."""
        pending: deque[ast.AST] = deque([annotation])
        while pending:
            node = pending.popleft()
            if type(node) is ast.Constant and type(node.value) is str:
                return True
            pending.extend(self._node_index.children(node))
        return False

    def _annotation_issues(self, annotation: ast.expr) -> list[JsonObject]:
        """Responsibilities: _annotation rule checks_."""
        issues: list[JsonObject] = []
        if self._tuple_type_names.annotation(annotation):
            issues.append({"line": annotation.lineno - 1, "kind": PYTHON_TUPLE_TYPE_RULE})
        if self._contains_string_literal(annotation):
            issues.append(
                {
                    "line": annotation.lineno - 1,
                    "kind": "python-string-type-annotation",
                },
            )
        return issues

    def _nested_generic(self, annotation: ast.AST) -> bool:
        """Responsibilities: _nested generic annotation detection_."""
        if type(annotation) is not ast.Subscript:
            return False
        if type(annotation.slice) in (ast.Subscript, ast.List, ast.Dict):
            return True
        return any(type(node) in (ast.Subscript, ast.List, ast.Dict) for node in ast.iter_child_nodes(annotation.slice))

    def _function_arguments(self, parameters: ast.arguments) -> list[ast.arg]:
        """Responsibilities: _function annotation parameter extraction_."""
        arguments = [*parameters.posonlyargs, *parameters.args, *parameters.kwonlyargs]
        if parameters.vararg is not None:
            arguments.append(parameters.vararg)
        if parameters.kwarg is not None:
            arguments.append(parameters.kwarg)
        return arguments

    def __init__(
        self,
        tuple_type_names: PythonTupleTypeNamesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _tuple annotation analysis dependency_."""
        self._tuple_type_names = tuple_type_names
        self._node_index = node_index

    def issues(self, declaration: ast.AST) -> list[JsonObject]:
        """Responsibilities: _declared annotation diagnostics_."""
        issues: list[JsonObject] = []
        for annotation in self._annotations(declaration):
            issues.extend(self._annotation_issues(annotation))
        return issues

    def generic_issues(self, declaration: PythonCallableAstNode) -> list[JsonObject]:
        """Responsibilities: _callable generic annotation diagnostics_."""
        match declaration:
            case ast.FunctionDef(args=parameters, returns=return_annotation):
                pass
            case ast.AsyncFunctionDef(args=parameters, returns=return_annotation):
                pass
        annotations = [
            argument.annotation for argument in self._function_arguments(parameters) if argument.annotation is not None
        ]
        if return_annotation is not None:
            annotations.append(return_annotation)
        return [
            {"line": annotation.lineno - 1, "kind": PYTHON_INLINE_GENERIC_TYPE_RULE}
            for annotation in annotations
            if self._nested_generic(annotation)
        ]
