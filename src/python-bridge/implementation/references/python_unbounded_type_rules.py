from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.constants import UNBOUNDED_TYPE_NAMES
from implementation.references.protocols import PythonScopedTypeAliasesContract
from implementation.types import JsonObject


class PythonUnboundedTypeRules:
    """Responsibilities: _unbounded type detection_, _annotation issue reporting_."""

    def _is_unbounded_name(self, name: str, context: ast.AST) -> bool:
        """Responsibilities: _unbounded name classification_."""
        resolved = self._type_aliases.resolve(name, context)
        if resolved in UNBOUNDED_TYPE_NAMES:
            return True
        name_parts = resolved.rsplit(".", 1)
        final_name = name_parts[-1]
        return final_name in UNBOUNDED_TYPE_NAMES

    def _is_unbounded_node(self, item: ast.AST, context: ast.AST) -> bool:
        """Responsibilities: _classification annotation node unbounded_."""
        if type(item) is ast.Name:
            return self._is_unbounded_name(item.id, context)
        if type(item) is ast.Attribute:
            return self._is_unbounded_name(ast.unparse(item), context)
        return False

    def _callable_arguments(self, parameters: ast.arguments) -> list[ast.arg]:
        """Responsibilities: _callable annotation arguments_."""
        arguments = [
            *parameters.posonlyargs,
            *parameters.args,
            *parameters.kwonlyargs,
        ]
        if parameters.vararg is not None:
            arguments.append(parameters.vararg)
        if parameters.kwarg is not None:
            arguments.append(parameters.kwarg)
        return arguments

    def _signature_annotations(self, callable_node: ast.AST) -> list[ast.expr]:
        """Responsibilities: _callable signature annotation collection_."""
        match callable_node:
            case ast.FunctionDef(args=parameters, returns=return_annotation) if type(
                callable_node,
            ) is ast.FunctionDef:
                pass
            case ast.AsyncFunctionDef(
                args=parameters,
                returns=return_annotation,
            ) if type(callable_node) is ast.AsyncFunctionDef:
                pass
            case _:
                return []
        arguments = self._callable_arguments(parameters)
        annotations = [argument.annotation for argument in arguments if argument.annotation is not None]
        if return_annotation is not None:
            annotations.append(return_annotation)
        return annotations

    def _callable_issues(self, callable_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _callable unbounded type issues_."""
        return [
            issue
            for annotation in self._signature_annotations(callable_node)
            for issue in self.annotation_issues(annotation)
        ]

    def _inside_callable(self, candidate: ast.AST) -> bool:
        """Responsibilities: _classification node nested callable_."""
        pending = list(self._node_index.parents(candidate))
        visited: set[ast.AST] = set()
        while pending:
            parent = pending.pop()
            if parent in visited:
                continue
            visited.add(parent)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return True
            pending.extend(self._node_index.parents(parent))
        return False

    def _type_expression(self, expression: ast.expr) -> bool:
        """Responsibilities: _identification assignments define type_."""
        if type(expression) in (ast.Name, ast.Attribute, ast.Subscript):
            return True
        if type(expression) is not ast.BinOp:
            return False
        return type(expression.op) is ast.BitOr

    def _module_annotation_issues(
        self,
        annotation_assignment: ast.AnnAssign,
    ) -> list[JsonObject]:
        """Responsibilities: _report unbounded module-level annotations_."""
        if self._inside_callable(annotation_assignment):
            return []
        issues = self.annotation_issues(annotation_assignment.annotation)
        if annotation_assignment.value is not None:
            if self._type_expression(annotation_assignment.value):
                issues.extend(self.annotation_issues(annotation_assignment.value))
        return issues

    def _module_assignment_issues(self, assignment: ast.Assign) -> list[JsonObject]:
        """Responsibilities: _reporting unbounded module-level type-expression_."""
        if self._inside_callable(assignment):
            return []
        if not self._type_expression(assignment.value):
            return []
        return self.annotation_issues(assignment.value)

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        type_aliases: PythonScopedTypeAliasesContract,
    ) -> None:
        """Responsibilities: _initialization Python tree reusable_."""
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._type_aliases: PythonScopedTypeAliasesContract = type_aliases

    def annotation_issues(self, annotation: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting unbounded nodes contained_."""
        return [
            {"line": node.lineno - 1, "kind": "unbounded-type"}
            for node in self._node_index.nodes(annotation)
            if self._is_unbounded_node(node, annotation)
        ]

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _collection unbounded annotation issues_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                issues.extend(self._callable_issues(node))
                continue
            if type(node) is ast.AnnAssign:
                issues.extend(self._module_annotation_issues(node))
            if type(node) is ast.Assign:
                issues.extend(self._module_assignment_issues(node))
        return issues
