from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.python_reference_context import PythonReferenceContext


@dataclass(frozen=True)
class PythonReferenceScenario:
    """Responsibilities: _AST source_, _symbol ownership_."""

    tree: ast.Module
    node_index: PythonAstNodeIndex
    return_state: CallReturns
    context: PythonReferenceContext
    annotation_names: AnnotationNames


@dataclass(frozen=True)
class PythonCallableConditionInputs:
    """Responsibilities: _callable node sources_, _AST parent ownership_."""

    tree: ast.Module
    node_index: PythonAstNodeIndex
    nodes: list[ast.AST]
    scopes: dict[ast.AST, str]
    parents: dict[int, ast.AST]
    calls: list[ast.Call]
