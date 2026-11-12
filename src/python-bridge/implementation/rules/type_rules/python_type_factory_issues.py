from __future__ import annotations

import ast
from collections import deque
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import PythonTypeFactoryNamesContract
from implementation.rules.constants import PYTHON_SIMPLE_NAMESPACE_NAME, PYTHON_TYPE_FACTORY_KIND
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonTypeFactoryIssues:
    """Responsibilities: _type factory recognition_, _factory issue reporting_."""

    _type_factory_names: PythonTypeFactoryNamesContract
    _node_index: PythonAstNodeIndexContract

    def _simple_namespace_reference(self, syntax_node: ast.AST) -> bool:
        """Responsibilities: _SimpleNamespace reference detection_."""
        match syntax_node:
            case ast.Name(id=name) if name == PYTHON_SIMPLE_NAMESPACE_NAME:
                return True
            case ast.Attribute(attr=attribute) if attribute == PYTHON_SIMPLE_NAMESPACE_NAME:
                return True
            case ast.ImportFrom(module="types", names=names):
                return any(imported.name == PYTHON_SIMPLE_NAMESPACE_NAME for imported in names)
            case ast.Call(func=ast.Name(id=method_name), args=arguments) if (
                method_name in ("getattr", "setattr") and len(arguments) > 1
            ):
                namespace_name = arguments[1]
                return type(namespace_name) is ast.Constant and namespace_name.value == PYTHON_SIMPLE_NAMESPACE_NAME
            case _:
                return False

    def _contains_factory_call(self, expression: ast.expr) -> bool:
        """Responsibilities: _nested type factory detection_."""
        pending: deque[ast.AST] = deque([expression])
        while pending:
            node = pending.popleft()
            match node:
                case ast.Call(func=function) if self._type_factory_names.matches(
                    function,
                ):
                    return True
            pending.extend(self._node_index.children(node))
        return False

    def __init__(
        self,
        type_factory_names: PythonTypeFactoryNamesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _type factory name dependency_."""
        self._type_factory_names: PythonTypeFactoryNamesContract = type_factory_names
        self._node_index: PythonAstNodeIndexContract = node_index

    def class_issues(self, class_definition: ast.ClassDef) -> list[JsonObject]:
        """Responsibilities: _type factory base issues_."""
        for base in class_definition.bases:
            if self._type_factory_names.matches(base):
                return [
                    {
                        "line": class_definition.lineno - 1,
                        "kind": PYTHON_TYPE_FACTORY_KIND,
                    },
                ]
        return []

    def assignment_issues(self, statement: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _type factory assignment analysis_."""
        match statement:
            case ast.Assign(value=expression) | ast.Expr(value=expression) if type(statement) in (ast.Assign, ast.Expr):
                pass
            case ast.AnnAssign(value=expression) | ast.Return(value=expression) if (
                type(statement) in (ast.AnnAssign, ast.Return) and expression is not None
            ):
                pass
            case _:
                return []
        if not self._contains_factory_call(expression):
            return []
        return [{"line": statement.lineno - 1, "kind": PYTHON_TYPE_FACTORY_KIND}]

    def issues(self, syntax_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _type factory issue classification_."""
        if self._simple_namespace_reference(syntax_node):
            return [{"line": cast(PythonASTLocatedNode, syntax_node).lineno - 1, "kind": PYTHON_TYPE_FACTORY_KIND}]
        match syntax_node:
            case ast.ClassDef() as class_definition if (
                type(
                    syntax_node,
                )
                is ast.ClassDef
            ):
                return self.class_issues(class_definition)
            case ast.stmt() as statement:
                return self.assignment_issues(statement)
            case _:
                return []
