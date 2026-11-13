from __future__ import annotations

import ast

from implementation.ast.constants import AST_INTERFACES_KEY, CLASS_BASE_CLASS_NAMES_KEY
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableStatementsContract,
)
from implementation.rules.constants import (
    PYTHON_DATACLASS_DECORATOR,
    PYTHON_INIT_METHOD,
    PYTHON_PROTOCOL_NAME,
)
from implementation.types import JsonObject, JsonValueList

NodeData = JsonObject


class PythonClassNodeDetails:
    """Responsibilities: _class metric collection_, _base and dataclass analysis_."""

    _node: ast.ClassDef
    _node_index: PythonAstNodeIndexContract
    _callable_statements: PythonCallableStatementsContract

    def _class_body(self) -> list[ast.stmt]:
        """Responsibilities: _output class body nested_."""
        body: list[ast.stmt] = []
        for item in self._node.body:
            is_string_expression = False
            if type(item) is ast.Expr and type(item.value) is ast.Constant:
                is_string_expression = type(item.value.value) is str
            if is_string_expression:
                continue
            body.append(item)
        return body

    def _class_sloc(self, method_nodes: list[NodeData]) -> int:
        """Responsibilities: _calculation class source lines_."""
        method_sloc: dict[int, int] = {}
        for item in method_nodes:
            start = item["start"]
            sloc = item["sloc"]
            if type(start) is not int or type(sloc) is not int:
                raise TypeError("method source metrics must be integers")
            method_sloc[start] = sloc
        total = 1 + len(self._node.decorator_list)
        for statement in self._callable_statements.body_without_docstring(
            self._node.body,
        ):
            total += method_sloc.get(statement.lineno - 1, 1)
        return total

    def _class_lines(self) -> int:
        """Responsibilities: _calculation line span covered_."""
        body = self._callable_statements.body_without_docstring(self._node.body)
        if not body:
            return 0
        first_line = body[0].lineno
        if self._node.decorator_list:
            first_line = min(first_line, self._node.decorator_list[0].lineno)
        last_line = body[-1].end_lineno
        if last_line is None:
            last_line = body[-1].lineno
        return self._callable_statements.count_non_docstring_lines(
            self._node,
            self._node_index,
            first_line,
            last_line,
        )

    def _is_dataclass(self) -> bool:
        """Responsibilities: _detection dataclass decorators class_."""
        for decorator in self._node.decorator_list:
            value = decorator
            if type(decorator) is ast.Call:
                value = decorator.func
            if self._is_dataclass_name(value):
                return True
        return False

    def _is_dataclass_name(self, value: ast.AST) -> bool:
        """Responsibilities: _classification decorator expression dataclass_."""
        if type(value) is ast.Name:
            return value.id == PYTHON_DATACLASS_DECORATOR
        if type(value) is ast.Attribute:
            return value.attr == PYTHON_DATACLASS_DECORATOR
        return False

    def _is_protocol(self) -> bool:
        """Responsibilities: _detection Protocol inheritance class_."""
        for base in self._node.bases:
            if type(base) is ast.Name and base.id == PYTHON_PROTOCOL_NAME:
                return True
            if type(base) is ast.Attribute and base.attr == PYTHON_PROTOCOL_NAME:
                return True
        return False

    def _is_type_contract(self) -> bool:
        """Responsibilities: _detection class bases define_."""
        body = self._class_body()
        if not body:
            return False
        return all(type(item) is ast.AnnAssign for item in body)

    def _constructor_nodes(self) -> list[ast.AST]:
        """Responsibilities: _collection constructor nodes_."""
        for item in self._node.body:
            if type(item) is ast.FunctionDef and item.name == PYTHON_INIT_METHOD:
                return self._node_index.nodes(item)
            if type(item) is ast.AsyncFunctionDef and item.name == PYTHON_INIT_METHOD:
                return self._node_index.nodes(item)
        return []

    def _field_nodes(self) -> list[ast.AST]:
        """Responsibilities: _collection class field nodes_."""
        nodes: list[ast.AST] = []
        for item in self._node.body:
            value = None
            if type(item) is ast.AnnAssign or type(item) is ast.Assign:
                value = item.value
            if value is not None:
                nodes.extend(self._node_index.nodes(value))
        return nodes

    def __init__(
        self,
        node: ast.ClassDef,
        node_index: PythonAstNodeIndexContract,
        callable_statements: PythonCallableStatementsContract,
    ) -> None:
        """Responsibilities: _initialization source class node_."""
        self._node: ast.ClassDef = node
        self._node_index: PythonAstNodeIndexContract = node_index
        self._callable_statements: PythonCallableStatementsContract = callable_statements

    def dependencies(self) -> list[str]:
        """Responsibilities: _collection construction dependencies_."""
        nodes = self._constructor_nodes()
        nodes.extend(self._field_nodes())
        return [item.func.id for item in nodes if type(item) is ast.Call and type(item.func) is ast.Name]

    def metadata(self, method_nodes: list[NodeData]) -> NodeData:
        """Responsibilities: _normalization class identity assembly_."""
        end_line = self._node.end_lineno
        if end_line is None:
            end_line = self._node.lineno
        base_class_names: JsonValueList = []
        base_class_names.extend(ast.unparse(base) for base in self._node.bases)
        return {
            "name": self._node.name,
            "start": self._node.lineno - 1,
            "end": end_line - 1,
            "lines": self._class_lines(),
            "sloc": self._class_sloc(method_nodes),
            "is_data_class": self._is_dataclass(),
            "type_contract": self._is_type_contract(),
            "protocol": self._is_protocol(),
            "extends_external_class": bool(self._node.bases),
            CLASS_BASE_CLASS_NAMES_KEY: base_class_names,
            AST_INTERFACES_KEY: [],
        }
