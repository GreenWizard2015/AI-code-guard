from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableStatementsContract,
)
from implementation.rules.constants import PYTHON_VALUE_NAME_KEY
from implementation.types import JsonObject


class CallableStatements(PythonCallableStatementsContract):
    """Responsibilities: _statement normalization_, _docstring line exclusion_."""

    def _assignment_value_name(self, value: ast.AST) -> str:
        """Responsibilities: _assigned alias name extraction_."""
        if type(value) is ast.Name:
            return value.id
        return ""

    def _assignment_record(
        self,
        item: ast.AST,
        target: ast.AST,
        value_name: str,
        simple_alias: bool,
    ) -> JsonObject:
        """Responsibilities: _assignment statement record creation_."""
        name = ""
        if type(target) is ast.Name:
            name = target.id
        statement: JsonObject = {
            "kind": "assignment",
            "line": item.lineno - 1,
            "simple_alias": simple_alias,
            "destructured": type(target) in (ast.Tuple, ast.List),
        }
        if name:
            statement["name"] = name
        if value_name:
            statement[PYTHON_VALUE_NAME_KEY] = value_name
        return statement

    def _value_assignment_record(
        self,
        item: ast.AST,
        target: ast.AST,
        value: ast.AST,
    ) -> JsonObject:
        """Responsibilities: _assignment value normalization_."""
        return self._assignment_record(
            item,
            target,
            self._assignment_value_name(value),
            type(value) is ast.Name,
        )

    def _assignment_statement(self, item: ast.AST, target: ast.AST) -> JsonObject:
        """Responsibilities: _assignment statement normalization_."""
        if type(item) is ast.Assign:
            return self._value_assignment_record(item, target, item.value)
        if type(item) is ast.AnnAssign:
            if item.value is None:
                return self._assignment_record(item, target, "", simple_alias=False)
            return self._value_assignment_record(item, target, item.value)
        return {}

    def _return_statement(self, item: ast.Return) -> JsonObject:
        """Responsibilities: _normalization output statement_."""
        statement: JsonObject = {
            "kind": "return",
            "line": item.lineno - 1,
        }
        if type(item.value) is ast.Name:
            statement["name"] = item.value.id
        return statement

    def _docstring_body(self, node: ast.AST) -> list[ast.stmt]:
        """Responsibilities: _docstring owner body selection_."""
        match node:
            case ast.Module(body=body) if type(node) is ast.Module:
                return body
            case ast.ClassDef(body=body) if type(node) is ast.ClassDef:
                return body
            case ast.FunctionDef(body=body) if type(node) is ast.FunctionDef:
                return body
            case ast.AsyncFunctionDef(body=body) if type(node) is ast.AsyncFunctionDef:
                return body
            case _:
                return []

    def _docstring_lines_for(self, node: ast.AST) -> set[int]:
        """Responsibilities: _collection docstring lines nested_."""
        body = self._docstring_body(node)
        if not body:
            return set()
        return self._docstring_statement_lines(body[0])

    def _docstring_statement_lines(self, statement: ast.stmt) -> set[int]:
        """Responsibilities: _docstring statement source span_."""
        if not self.string_statement(statement):
            return set()
        match statement:
            case ast.Expr(
                value=ast.Constant(value=value, lineno=line, end_lineno=end_line),
            ):
                if type(value) is not str:
                    return set()
            case _:
                return set()
        if end_line is None:
            end_line = line
        return set(range(line, end_line + 1))

    def statement_node(self, item: ast.stmt) -> JsonObject:
        """Responsibilities: _classification normalization Python statement_."""
        if type(item) is ast.Assign:
            target: ast.AST = ast.Constant(value=None)
            if len(item.targets) == 1:
                target = item.targets[0]
            return self._assignment_statement(item, target)
        if type(item) is ast.AnnAssign:
            return self._assignment_statement(item, item.target)
        if type(item) is ast.Return:
            return self._return_statement(item)
        return {"kind": "other", "line": item.lineno - 1}

    def _append_assignment_value(self, result: set[int], node: ast.AST) -> None:
        """Responsibilities: _assignment value identity recording_."""
        match node:
            case ast.Assign(value=value) | ast.AugAssign(value=value) if type(node) in (
                ast.Assign,
                ast.AugAssign,
            ):
                pass
            case ast.AnnAssign(value=value) if type(node) is ast.AnnAssign:
                if value is None:
                    result.add(id(None))
                    return
            case _:
                return
        if type(value) is not ast.Constant or value.value is not None:
            result.add(id(value))

    def assignment_value_ids(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
    ) -> set[int]:
        """Responsibilities: _collection names assigned statement_."""
        result: set[int] = set()
        for node in node_index.nodes(tree):
            self._append_assignment_value(result, node)
        return result

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]:
        """Responsibilities: _removal leading docstring callable_."""
        if body:
            if self.string_statement(body[0]):
                return body[1:]
        return body

    def collect_docstring_lines(
        self,
        root: ast.AST,
        node_index: PythonAstNodeIndexContract,
    ) -> set[int]:
        """Responsibilities: _collection source lines occupied_."""
        lines: set[int] = set()
        for node in node_index.nodes(root):
            lines.update(self._docstring_lines_for(node))
        return lines

    def count_non_docstring_lines(
        self,
        root: ast.AST,
        node_index: PythonAstNodeIndexContract,
        first_line: int,
        last_line: int,
    ) -> int:
        """Responsibilities: _source line span analysis_."""
        span_length = last_line - first_line
        span_length += 1
        docstring_line_count = 0
        for line in self.collect_docstring_lines(root, node_index):
            if first_line <= line <= last_line:
                docstring_line_count += 1
        return span_length - docstring_line_count

    def string_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _classification statement string literal_."""
        if type(statement) is not ast.Expr:
            return False
        if type(statement.value) is not ast.Constant:
            return False
        return type(statement.value.value) is str
