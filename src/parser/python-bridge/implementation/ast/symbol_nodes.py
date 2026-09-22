from __future__ import annotations


from functools import cached_property
from typing import Any
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
import ast


class PythonAstSymbolNodes:
    """Responsibilities: _collection Python symbols classification_."""

    def _type_declaration(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python type declarations collection_."""
        if type(node) is ast.ClassDef:
            return [{"name": node.name, "line": node.lineno - 1}]
        if type(node) is ast.AnnAssign:
            target: Any = node.target
            annotation: Any = node.annotation
            if type(target) is ast.Name and type(annotation) is ast.Name:
                if annotation.id == "TypeAlias":
                    return [{"name": target.id, "line": node.lineno - 1}]
        if type(node) is ast.Assign and len(node.targets) == 1:
            target: Any = node.targets[0]
            named_type = type(target) is ast.Name
            if named_type and self.callable_arguments.structural_type(node.value):
                return [{"name": target.id, "line": node.lineno - 1}]
        return []

    def _collect_module_instances(self) -> list[JsonObject]:
        """Responsibilities: _module instances collection_."""
        instances: Any = []
        for node in self.tree.body:
            value: Any = self._assignment_value(node)
            if type(value) is ast.Constant and value.value is None:
                continue
            if type(value) is not ast.Call:
                continue
            if type(value.func) is not ast.Name:
                continue
            instances.append({"line": node.lineno - 1, "constructor": value.func.id})
        return instances

    def _assignment_value(self, node: ast.AST) -> ast.expr:
        """Responsibilities: _assignment value identification_."""
        if type(node) is ast.Assign:
            return node.value
        if type(node) is ast.AnnAssign:
            return node.value
        return ast.Constant(value=None)

    def _named_symbol(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _named symbol collection_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return [self._function_symbol(node, self._function_kind(node))]
        if type(node) is ast.arg:
            return [{"name": node.arg, "line": node.lineno - 1, "kind": "variable"}]
        if type(node) is ast.Name and type(node.ctx) is ast.Store:
            return self._stored_name_symbol(node)
        return []

    def _stored_name_symbol(self, node: ast.Name) -> list[JsonObject]:
        """Responsibilities: _classification storage name symbol_."""
        if self._is_type_alias(node):
            return [{"name": node.id, "line": node.lineno - 1, "kind": "type_alias"}]
        if self._is_contract_field(node):
            return []
        return [self._stored_symbol(node)]

    def _function_kind(self, node: ast.AST) -> str:
        """Responsibilities: _function symbol classification_."""
        if type(self._parents.get(id(node))) is ast.ClassDef:
            return "method"
        return "function"

    def _function_symbol(self, node: ast.AST, kind: str) -> JsonObject:
        """Responsibilities: _function symbol construction_."""
        data: JsonObject = {
            "name": node.name,
            "line": node.lineno - 1,
            "kind": kind,
            "visibility": self._function_visibility(node, kind),
        }
        is_module_function: Any = False
        if kind == "function":
            is_module_function: Any = self._is_module_scope(node)
        data["is_module_function"] = is_module_function
        return data

    def _stored_symbol(self, node: ast.Name) -> JsonObject:
        """Responsibilities: _symbol construction_."""
        kind: Any = self._stored_symbol_kind(node)
        is_module_constant: Any = kind == "constant"
        if is_module_constant:
            is_module_constant: Any = self._is_module_scope(node)
        return {
            "name": node.id,
            "line": node.lineno - 1,
            "kind": kind,
            "is_module_constant": is_module_constant,
        }

    def _stored_symbol_kind(self, node: ast.Name) -> str:
        """Responsibilities: _symbol classification_."""
        if node.id.isupper():
            return "constant"
        parent: Any = self._parents.get(id(node))
        if type(parent) in (ast.Assign, ast.AnnAssign):
            if type(self._parents.get(id(parent))) is ast.ClassDef:
                return "field"
        return "variable"

    def _is_module_scope(self, node: ast.AST) -> bool:
        """Responsibilities: _module-level symbols identification_."""
        current: Any = self._parents.get(id(node))
        while current is not None:
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return False
            current: Any = self._parents.get(id(current))
        return True

    def _function_visibility(self, node: ast.AST, kind: str) -> str:
        """Responsibilities: _function visibility identification_."""
        if kind != "method":
            return "public"
        return self.callable_arguments.method_visibility(node.name)

    def _is_contract_field(self, node: ast.Name) -> bool:
        """Responsibilities: _contract fields identification_."""
        assignment: Any = self._parents.get(id(node))
        class_node: Any = None
        if assignment is not None:
            class_node: Any = self._parents.get(id(assignment))
        if type(class_node) is not ast.ClassDef:
            return False
        if not class_node.body:
            return False
        return all(type(item) is ast.AnnAssign for item in class_node.body)

    def _is_type_alias(self, node: ast.Name) -> bool:
        """Responsibilities: _type aliases identification_."""
        assignment: Any = self._parents.get(id(node))
        if type(assignment) is ast.AnnAssign:
            annotation: Any = assignment.annotation
            is_named_annotation = type(annotation) is ast.Name
            return is_named_annotation and annotation.id == "TypeAlias"
        if type(assignment) is not ast.Assign:
            return False
        if node.id.isupper() or not self._is_module_scope(node):
            return False
        is_single_target = len(assignment.targets) == 1
        if not is_single_target or assignment.targets[0] is not node:
            return False
        return self.callable_arguments.structural_type(assignment.value)

    @cached_property
    def _parents(self) -> dict[int, ast.AST]:
        """Responsibilities: _collection Python AST parent_."""
        parents: dict[int, ast.AST] = {}
        for node in self.node_index.nodes(self.tree):
            for child in ast.iter_child_nodes(node):
                parents[id(child)] = node
        return parents

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexProtocol
    ) -> None:
        """Responsibilities: _Python symbol analysis initialization_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.callable_arguments: Any = CallableArguments(node_index)

    @cached_property
    def named_symbols(self) -> list[JsonObject]:
        """Responsibilities: _named symbols exposure collection_."""
        symbols: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            symbols.extend(self._named_symbol(node))
        return symbols

    @cached_property
    def type_declarations(self) -> list[JsonObject]:
        """Responsibilities: _type declarations exposure collection_."""
        declarations: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            declarations.extend(self._type_declaration(node))
        return declarations

    @cached_property
    def module_instances(self) -> list[JsonObject]:
        """Responsibilities: _module instances exposure collection_."""
        return self._collect_module_instances()
