from __future__ import annotations


import ast
from typing import Any
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.private_vars_mapping import PythonPrivateVarsMapping
from implementation.rules.builtin_reflection import PythonBuiltinReflectionNames


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
        if type(node) is not ast.Attribute:
            return ""
        if type(node.ctx) is not ast.Store:
            return ""
        if type(node.value) is not ast.Name:
            return ""
        if node.value.id not in {"self", "cls"}:
            return ""
        if node.attr.startswith("__"):
            if node.attr.endswith("__"):
                return ""
        if node.attr.startswith("_"):
            return node.attr
        return ""

    def _private_member_name(self, name: str) -> str:
        """Responsibilities: _private member name filtering_."""
        if not name:
            return ""
        if not name.startswith("_"):
            return ""
        if name.startswith("__"):
            if name.endswith("__"):
                return ""
        return name

    def _class_members(self, node: ast.ClassDef) -> set[str]:
        """Responsibilities: _collection private members declared_."""
        result: set[str] = set()
        for member in node.body:
            name: Any = self._member_name(member)
            private_name = self._private_member_name(name)
            if not private_name:
                continue
            result.add(private_name)
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
        reflection_name: str = self.reflection_names.access_name(function)
        if reflection_name:
            if reflection_name == "vars":
                return False
            return self._builtin_call(node, members)
        if type(function) is not ast.Attribute:
            return False
        if function.attr not in {"__getattribute__", "__setattr__"}:
            return False
        return self._attribute_call(node, function.value, members)

    def _builtin_call(self, node: ast.Call, members: set[str]) -> bool:
        """Responsibilities: _classification builtin access targets_."""
        if len(node.args) < 2:
            return False
        member = self.container_keys.string_value(node.args[1])
        if member not in members:
            return False
        target: Any = node.args[0]
        if type(target) is ast.Name:
            if target.id in {"self", "cls"}:
                return False
        return True

    def _attribute_call(
        self, node: ast.Call, target: ast.AST, members: set[str]
    ) -> bool:
        """Responsibilities: _classification attribute invocation access_."""
        if not node.args:
            return False
        member = self.container_keys.string_value(node.args[0])
        if member not in members:
            return False
        if type(target) is ast.Name:
            if target.id in {"self", "cls"}:
                return False
        return True

    def _private_access(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _classification supported private access_."""
        if self._private_call(node, members):
            return True
        if self.private_vars_mapping.dictionary(node, members):
            return True
        if self.private_vars_mapping.vars_mapping(node, members):
            return True
        return self.private_vars_mapping.vars_method(node, members)

    def _attribute_lines(self, node: ast.AST, members: set[str]) -> set[int]:
        """Responsibilities: _direct private attribute access classification_."""
        if type(node) is not ast.Attribute:
            return set()
        if node.attr not in members:
            return set()
        is_instance_access = type(node.value) is ast.Name
        if is_instance_access:
            is_instance_access = node.value.id in {"self", "cls"}
        if is_instance_access:
            return set()
        return {node.lineno - 1}

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexProtocol
    ) -> None:
        """Responsibilities: _initialization source tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.container_aliases: PythonContainerAliasesProtocol = PythonContainerAliases()
        self.container_keys: PythonContainerKeys = PythonContainerKeys(self.container_aliases)
        self.reflection_names: PythonBuiltinReflectionNames = PythonBuiltinReflectionNames()
        self.private_vars_mapping: PythonPrivateVarsMapping = PythonPrivateVarsMapping(
            self.reflection_names,
            self.container_keys.string_value,
        )

    def member_names(self) -> set[str]:
        """Responsibilities: _collection private member names_."""
        self.container_aliases.observe_all(self.node_index.nodes(self.tree))
        result: set[str] = set()
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.ClassDef:
                result.update(self._class_members(node))
        return result

    def accesses(self, members: set[str]) -> list[dict[str, int]]:
        """Responsibilities: _collection private access diagnostics_."""
        self.container_aliases.observe_all(self.node_index.nodes(self.tree))
        self.reflection_names.configure(self.tree)
        lines: set[int] = set()
        for node in self.node_index.nodes(self.tree):
            lines.update(self._attribute_lines(node, members))
            if type(node) is ast.Attribute:
                continue
            if self._private_access(node, members):
                lines.add(node.lineno - 1)
        return [{"line": line} for line in sorted(lines)]
