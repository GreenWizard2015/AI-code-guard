from __future__ import annotations


import ast
from typing import Any
from implementation.ast.protocols import PythonAstNodeIndexProtocol


class PythonPrivateAccessCollector:
    """Responsibilities: _indexing private members collection_."""

    def _member_name(self, member: ast.AST) -> str:
        """Responsibilities: _resolution attribute member name_."""
        if type(member) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return member.name
        is_annotated_name = type(member) is ast.AnnAssign
        if is_annotated_name:
            is_annotated_name = type(member.target) is ast.Name
        if is_annotated_name:
            return member.target.id
        return ""

    def _stored_member(self, node: ast.AST) -> str:
        """Responsibilities: _resolution member name storage_."""
        if type(node) is not ast.Attribute or type(node.ctx) is not ast.Store:
            return ""
        if type(node.value) is not ast.Name:
            return ""
        if node.value.id not in {"self", "cls"}:
            return ""
        if node.attr.startswith("__") and node.attr.endswith("__"):
            return ""
        if node.attr.startswith("_"):
            return node.attr
        return ""

    def _class_members(self, node: ast.ClassDef) -> set[str]:
        """Responsibilities: _collection private members declared_."""
        result: set[str] = set()
        for member in node.body:
            name: Any = self._member_name(member)
            if not name or not name.startswith("_"):
                continue
            if name.startswith("__") and name.endswith("__"):
                continue
            result.add(name)
        for nested in self.node_index.nodes(node):
            name: Any = self._stored_member(nested)
            if name:
                result.add(name)
        return result

    def _private_call(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification direct invocation private_."""
        if type(node) is not ast.Call:
            return False
        function: Any = node.func
        if type(function) is ast.Name:
            if function.id in {"getattr", "setattr"}:
                return self._builtin_call(node, members)
            return False
        if type(function) is not ast.Attribute:
            return False
        if function.attr not in {"__getattribute__", "__setattr__"}:
            return False
        return self._attribute_call(node, function.value, members)

    def _builtin_call(self, node: ast.Call, members: set[str]) -> bool:
        """Responsibilities: _classification builtin access targets_."""
        if len(node.args) < 2:
            return False
        if type(node.args[1]) is not ast.Constant:
            return False
        if node.args[1].value not in members:
            return False
        target: Any = node.args[0]
        if type(target) is ast.Name and target.id in {"self", "cls"}:
            return False
        return True

    def _attribute_call(
        self, node: ast.Call, target: ast.AST, members: set[str]
    ) -> bool:
        """Responsibilities: _classification attribute invocation access_."""
        if not node.args or type(node.args[0]) is not ast.Constant:
            return False
        if node.args[0].value not in members:
            return False
        if type(target) is ast.Name and target.id in {"self", "cls"}:
            return False
        return True

    def _private_mapping(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification mapping-style private member_."""
        if type(node) is not ast.Subscript or type(node.slice) is not ast.Constant:
            return False
        if node.slice.value not in members:
            return False
        value: Any = node.value
        if type(value) is not ast.Attribute or value.attr != "__dict__":
            return False
        if type(value.value) is not ast.Name:
            return True
        if value.value.id in {"self", "cls"}:
            return False
        return True

    def _private_access(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification supported private access_."""
        if self._private_call(node, members):
            return True
        return self._private_mapping(node, members)

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexProtocol
    ) -> None:
        """Responsibilities: _initialization source tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index

    def member_names(self) -> set[str]:
        """Responsibilities: _collection private member names_."""
        result: set[str] = set()
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.ClassDef:
                result.update(self._class_members(node))
        return result

    def accesses(self, members: set[str]) -> list[dict[str, int]]:
        """Responsibilities: _collection private access diagnostics_."""
        lines: set[int] = set()
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.Attribute and node.attr in members:
                is_instance_access = type(node.value) is ast.Name
                if is_instance_access:
                    is_instance_access = node.value.id in {"self", "cls"}
                if not is_instance_access:
                    lines.add(node.lineno - 1)
                continue
            if self._private_access(node, members):
                lines.add(node.lineno - 1)
        return [{"line": line} for line in sorted(lines)]
