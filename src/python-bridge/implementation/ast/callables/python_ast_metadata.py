from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstContentTreeViewContract
from implementation.types import JsonObject


class PythonAstMetadata:
    """Responsibilities: _module exports_, _scope docstring spans_."""

    def _expression_names(self, value: ast.AST) -> list[str]:
        """Responsibilities: _literal export name extraction_."""
        if type(value) is ast.Constant and type(value.value) is str:
            return [value.value]
        if type(value) is ast.List:
            return self._sequence_names(value.elts)
        if type(value) is ast.Tuple:
            return self._sequence_names(value.elts)
        if type(value) is ast.Set:
            return self._sequence_names(value.elts)
        if type(value) is ast.BinOp and type(value.op) is ast.Add:
            left_names = self._expression_names(value.left)
            right_names = self._expression_names(value.right)
            return left_names + right_names
        return []

    def _sequence_names(self, expressions: list[ast.expr]) -> list[str]:
        """Responsibilities: _sequence export name extraction_."""
        names: list[str] = []
        for expression in expressions:
            names.extend(self._expression_names(expression))
        return names

    def _all_assignment(self, statement: ast.stmt) -> bool:
        """Responsibilities: _module export assignment recognition_."""
        if type(statement) is ast.Assign:
            return any(type(target) is ast.Name and target.id == "__all__" for target in statement.targets)
        if type(statement) is ast.AnnAssign:
            target = statement.target
            return type(target) is ast.Name and target.id == "__all__"
        if type(statement) is ast.AugAssign:
            target = statement.target
            return type(target) is ast.Name and target.id == "__all__"
        return False

    def _assigned_names(self, statement: ast.stmt) -> list[str]:
        """Responsibilities: _assigned export name extraction_."""
        if type(statement) is ast.Assign:
            return self._expression_names(statement.value)
        if type(statement) is ast.AnnAssign:
            if statement.value is not None:
                return self._expression_names(statement.value)
        if type(statement) is ast.AugAssign:
            return self._expression_names(statement.value)
        return []

    def _span(self, value: ast.Constant) -> JsonObject:
        """Responsibilities: _docstring source span conversion_."""
        end_line = value.end_lineno
        if end_line is None:
            end_line = value.lineno
        end_column = value.end_col_offset
        if end_column is None:
            end_column = value.col_offset
        return {
            "start_line": value.lineno - 1,
            "start_column": value.col_offset,
            "end_line": end_line - 1,
            "end_column": end_column,
        }

    def _append_body_span(self, body: list[ast.stmt], spans: list[JsonObject]) -> None:
        """Responsibilities: _leading docstring span collection_."""
        if not body:
            return
        expression = body[0]
        if not self._tree.analysis_state().tree_dependencies().callable_statements().string_statement(expression):
            return
        if type(expression) is not ast.Expr:
            return
        if type(expression.value) is not ast.Constant:
            return
        spans.append(self._span(expression.value))

    def __init__(self, tree: PythonAstContentTreeViewContract) -> None:
        """Responsibilities: _AST metadata source_."""
        self._tree: PythonAstContentTreeViewContract = tree

    def export_names(self) -> list[str]:
        """Responsibilities: _module export names_."""
        names: list[str] = []
        for statement in self._tree.tree().body:
            if not self._all_assignment(statement):
                continue
            if type(statement) is ast.AnnAssign and statement.value is None:
                continue
            assigned_names = self._assigned_names(statement)
            if type(statement) is ast.AugAssign:
                names.extend(assigned_names)
                continue
            names = assigned_names
        return list(dict.fromkeys(names))

    def docstring_locations(self) -> list[JsonObject]:
        """Responsibilities: _scope docstring spans_."""
        spans: list[JsonObject] = []
        for node in self._tree.analysis_state().core().source_dependencies().node_index().nodes(self._tree.tree()):
            if type(node) is ast.Module:
                self._append_body_span(node.body, spans)
                continue
            if type(node) is ast.ClassDef:
                self._append_body_span(node.body, spans)
                continue
            if type(node) is ast.FunctionDef:
                self._append_body_span(node.body, spans)
                continue
            if type(node) is ast.AsyncFunctionDef:
                self._append_body_span(node.body, spans)
        return spans
