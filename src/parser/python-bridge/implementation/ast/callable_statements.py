from __future__ import annotations


from typing import Any
import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class CallableStatements:
    """Responsibilities: _normalization Python assignments output_."""

    def _assignment_names(self, target: ast.AST, value: ast.AST) -> dict[str, str]:
        """Responsibilities: _assignment targets their mapping_."""
        name: Any = ""
        value_name: Any = ""
        if type(target) is ast.Name:
            name: Any = target.id
        if type(value) is ast.Name:
            value_name: Any = value.id
        return {"name": name, "value_name": value_name}

    def _assignment_statement(self, item: ast.AST, target: ast.AST) -> JsonObject:
        """Responsibilities: _assignment statement normalization_."""
        if type(item) not in (ast.Assign, ast.AnnAssign):
            return {}
        names: Any = self._assignment_names(target, item.value)
        name: Any = names["name"]
        value_name: Any = names["value_name"]
        statement: dict[str, Any] = {
            "kind": "assignment",
            "line": item.lineno - 1,
            "simple_alias": type(item.value) is ast.Name,
            "destructured": type(target) in (ast.Tuple, ast.List),
        }
        if name:
            statement["name"] = name
        if value_name:
            statement["value_name"] = value_name
        return statement

    def _return_statement(self, item: ast.Return) -> JsonObject:
        """Responsibilities: _normalization output statement_."""
        statement: dict[str, Any] = {
            "kind": "return",
            "line": item.lineno - 1,
        }
        if type(item.value) is ast.Name:
            statement["name"] = item.value.id
        return statement

    def _docstring_lines_for(self, node: ast.AST) -> set[int]:
        """Responsibilities: _collection docstring lines nested_."""
        if type(node) not in (
            ast.Module,
            ast.ClassDef,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
        ):
            return set()
        body: Any = node.body
        if not body or not self.string_statement(body[0]):
            return set()
        docstring: Any = body[0]
        end_line: Any = docstring.end_lineno
        if end_line is None:
            end_line = docstring.lineno
        return set(range(docstring.lineno, end_line + 1))

    def __init__(self) -> None:
        """Responsibilities: _statement classification state initialization_."""
        self.assignment_types: Any = (ast.Assign, ast.AnnAssign, ast.AugAssign)

    def statement_node(self, item: ast.stmt) -> JsonObject:
        """Responsibilities: _classification normalization Python statement_."""
        if type(item) is ast.Assign:
            target: Any = ast.Constant(value=None)
            if len(item.targets) == 1:
                target: Any = item.targets[0]
            return self._assignment_statement(item, target)
        if type(item) is ast.AnnAssign:
            return self._assignment_statement(item, item.target)
        if type(item) is ast.Return:
            return self._return_statement(item)
        return {"kind": "other", "line": item.lineno - 1}

    def assignment_value_ids(
        self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol
    ) -> set[int]:
        """Responsibilities: _collection names assigned statement_."""
        result: set[int] = set()
        for node in node_index.nodes(tree):
            value: Any = ast.Constant(value=None)
            if type(node) in self.assignment_types:
                value: Any = node.value
            if type(value) is not ast.Constant or value.value is not None:
                result.add(id(value))
        return result

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]:
        """Responsibilities: _removal leading docstring callable_."""
        if body and self.string_statement(body[0]):
            return body[1:]
        return body

    def collect_docstring_lines(self, root: ast.AST) -> set[int]:
        """Responsibilities: _collection source lines occupied_."""
        lines: set[int] = set()
        for node in ast.walk(root):
            lines.update(self._docstring_lines_for(node))
        return lines

    def string_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _classification statement string literal_."""
        if type(statement) is not ast.Expr:
            return False
        if type(statement.value) is not ast.Constant:
            return False
        return type(statement.value.value) is str
