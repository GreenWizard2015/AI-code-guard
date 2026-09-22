from __future__ import annotations

import ast

from implementation.ast.class_node_fields import PythonClassNodeFields
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject

NodeData = JsonObject


class PythonClassNodeDetails:
    """Responsibilities: _derivation Python class bodies_."""

    node: ast.ClassDef
    node_index: PythonAstNodeIndexProtocol
    callable_statements: CallableStatements
    field_details: PythonClassNodeFields

    def _class_body(self) -> list[ast.stmt]:
        """Responsibilities: _output class body nested_."""
        body: list[ast.stmt] = []
        for item in self.node.body:
            is_string_expression = type(item) is ast.Expr
            if is_string_expression and type(item.value) is ast.Constant:
                is_string_expression = type(item.value.value) is str
            if is_string_expression:
                continue
            body.append(item)
        return body

    def _base_names(self) -> list[str]:
        """Responsibilities: _collection textual base class_."""
        names: list[str] = []
        for base in self.node.bases:
            names.append(ast.unparse(base))
        return names

    def _class_sloc(self, method_nodes: list[NodeData]) -> int:
        """Responsibilities: _calculation class source lines_."""
        method_sloc = {item["start"]: item["sloc"] for item in method_nodes}
        total = 1 + len(self.node.decorator_list)
        for item in self.callable_statements.body_without_docstring(self.node.body):
            total += method_sloc.get(item.lineno - 1, 1)
        return total

    def _class_lines(self) -> int:
        """Responsibilities: _calculation line span covered_."""
        body = self.callable_statements.body_without_docstring(self.node.body)
        if not body:
            return 0
        first_line = body[0].lineno
        if self.node.decorator_list:
            first_line = min(first_line, self.node.decorator_list[0].lineno)
        last_line = body[-1].end_lineno
        if last_line is None:
            last_line = body[-1].lineno
        class_lines = set(range(first_line, last_line + 1))
        return len(
            class_lines - self.callable_statements.collect_docstring_lines(self.node)
        )

    def _is_dataclass(self) -> bool:
        """Responsibilities: _detection dataclass decorators class_."""
        for decorator in self.node.decorator_list:
            value = decorator
            if type(decorator) is ast.Call:
                value = decorator.func
            if self._is_dataclass_name(value):
                return True
        return False

    def _is_dataclass_name(self, value: ast.AST) -> bool:
        """Responsibilities: _classification decorator expression dataclass_."""
        if type(value) is ast.Name:
            return value.id == "dataclass"
        if type(value) is ast.Attribute:
            return value.attr == "dataclass"
        return False

    def _is_protocol(self) -> bool:
        """Responsibilities: _detection Protocol inheritance class_."""
        for base in self.node.bases:
            if type(base) is ast.Name and base.id == "Protocol":
                return True
            if type(base) is ast.Attribute and base.attr == "Protocol":
                return True
        return False

    def _is_type_contract(self) -> bool:
        """Responsibilities: _detection class bases define_."""
        body = self._class_body()
        if not body:
            return False
        for item in body:
            if type(item) is not ast.AnnAssign:
                return False
        return True

    def __init__(
        self,
        node: ast.ClassDef,
        node_index: PythonAstNodeIndexProtocol,
        callable_statements: CallableStatements,
    ) -> None:
        """Responsibilities: _initialization source class node_."""
        self.node: ast.ClassDef = node
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.callable_statements: CallableStatements = callable_statements
        self.field_details: PythonClassNodeFields = PythonClassNodeFields(node)

    def dependencies(self) -> list[str]:
        """Responsibilities: _collection class dependencies field_."""
        dependencies: list[str] = []
        for item in self.node_index.nodes(self.node):
            if type(item) is ast.Call and type(item.func) is ast.Name:
                dependencies.append(item.func.id)
        return dependencies

    def metadata(self, method_nodes: list[NodeData]) -> NodeData:
        """Responsibilities: _normalization class identity assembly_."""
        base_class_names = self._base_names()
        end_line = self.node.end_lineno
        if end_line is None:
            end_line = self.node.lineno
        return {
            "name": self.node.name,
            "start": self.node.lineno - 1,
            "end": end_line - 1,
            "lines": self._class_lines(),
            "sloc": self._class_sloc(method_nodes),
            "is_data_class": self._is_dataclass(),
            "type_contract": self._is_type_contract(),
            "protocol": self._is_protocol(),
            "extends_external_class": bool(self.node.bases),
            "base_class_name": "",
            "base_class_names": base_class_names,
            "interfaces": [],
        }
