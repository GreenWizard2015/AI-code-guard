from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from protocols import PythonModuleInstanceCollectorContract
from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.ast.protocols import PythonCallableArgumentsContract
from implementation.rules.protocols import PythonTypeDeclarationCollectorContract
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_CONSTANT_KIND,
    PYTHON_FUNCTION_KIND,
    PYTHON_VARIABLE_KIND,
)


@dataclass(frozen=True)
class PythonAstSymbolNodesOptions:
    """Responsibilities: _Python syntax tree input_, _symbol classification dependencies_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    callable_arguments: PythonCallableArgumentsContract
    type_collector: PythonTypeDeclarationCollectorContract
    instance_collector: PythonModuleInstanceCollectorContract


class PythonAstSymbolNodes:
    """Responsibilities: _symbol classification_, _symbol declaration normalization_."""

    def _named_symbol(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _named symbol collection_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return [self._function_symbol(node, self._function_kind(node))]
        if type(node) is ast.arg:
            return [
                {
                    "name": node.arg,
                    "line": node.lineno - 1,
                    "kind": PYTHON_VARIABLE_KIND,
                }
            ]
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
        if type(self._parent(node)) is ast.ClassDef:
            return "method"
        return PYTHON_FUNCTION_KIND

    def _function_symbol(self, node: ast.AST, kind: str) -> JsonObject:
        """Responsibilities: _function symbol construction_."""
        data: JsonObject = {
            "name": node.name,
            "line": node.lineno - 1,
            "kind": kind,
            "visibility": self._function_visibility(node, kind),
        }
        is_module_function: Any = False
        if kind == PYTHON_FUNCTION_KIND:
            is_module_function: Any = self._is_module_scope(node)
        data["is_module_function"] = is_module_function
        return data

    def _stored_symbol(self, node: ast.Name) -> JsonObject:
        """Responsibilities: _symbol construction_."""
        kind: Any = self._stored_symbol_kind(node)
        is_module_constant: Any = kind == PYTHON_CONSTANT_KIND
        if is_module_constant:
            is_module_constant: Any = self._is_module_scope(node)
        is_module_variable: Any = False
        if kind == PYTHON_VARIABLE_KIND:
            is_module_variable = self._is_module_scope(node)
        return {
            "name": node.id,
            "line": node.lineno - 1,
            "kind": kind,
            "is_module_constant": is_module_constant,
            "is_module_variable": is_module_variable,
            "visibility": "public",
            "is_module_function": False,
        }

    def _stored_symbol_kind(self, node: ast.Name) -> str:
        """Responsibilities: _symbol classification_."""
        if node.id.isupper():
            return PYTHON_CONSTANT_KIND
        parent: Any = self._parent(node)
        if type(parent) in (ast.Assign, ast.AnnAssign):
            if type(self._parent(parent)) is ast.ClassDef:
                return "field"
        return PYTHON_VARIABLE_KIND

    def _is_module_scope(self, node: ast.AST) -> bool:
        """Responsibilities: _module-level symbols identification_."""
        current: Any = self._parent(node)
        while current is not self.tree:
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return False
            current: Any = self._parent(current)
        return True

    def _function_visibility(self, node: ast.AST, kind: str) -> str:
        """Responsibilities: _function visibility identification_."""
        if kind != "method":
            return "public"
        return self.callable_arguments.method_visibility(node.name)

    def _is_contract_field(self, node: ast.Name) -> bool:
        """Responsibilities: _contract fields identification_."""
        assignment: Any = self._parent(node)
        class_node: Any = None
        if assignment is not None:
            class_node: Any = self._parent(assignment)
        if type(class_node) is not ast.ClassDef:
            return False
        if not class_node.body:
            return False
        return all(type(item) is ast.AnnAssign for item in class_node.body)

    def _is_type_alias(self, node: ast.Name) -> bool:
        """Responsibilities: _type aliases identification_."""
        assignment: Any = self._parent(node)
        if type(assignment) is ast.AnnAssign:
            annotation: Any = assignment.annotation
            return self.type_collector.type_alias_annotation(annotation)
        if type(assignment) is not ast.Assign:
            return False
        return self._assignment_alias(node, assignment)

    def _assignment_alias(self, node: ast.Name, assignment: ast.Assign) -> bool:
        """Responsibilities: _assignment type alias_."""
        if node.id.isupper():
            return False
        if not self._is_module_scope(node):
            return False
        is_single_target = len(assignment.targets) == 1
        if not is_single_target:
            return False
        if assignment.targets[0] is not node:
            return False
        return self.callable_arguments.structural_type(assignment.value)

    def _parent(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _existing AST parent lookup_."""
        parents = self.node_index.parents(node)
        if len(parents) == 0:
            return self.tree
        return parents[-1]

    def __init__(self, options: PythonAstSymbolNodesOptions) -> None:
        """Responsibilities: _Python symbol analysis initialization_."""
        self.tree: Any = options.tree
        self.node_index: Any = options.node_index
        self.callable_arguments: PythonCallableArgumentsContract = (
            options.callable_arguments
        )
        self.type_collector: PythonTypeDeclarationCollectorContract = (
            options.type_collector
        )
        self.instance_collector: PythonModuleInstanceCollectorContract = (
            options.instance_collector
        )

    def named_symbols(self) -> list[JsonObject]:
        """Responsibilities: _named symbols exposure collection_."""
        symbols: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            symbols.extend(self._named_symbol(node))
        return symbols

    def type_declarations(self) -> list[JsonObject]:
        """Responsibilities: _type declarations exposure collection_."""
        nodes = self.node_index.nodes(self.tree)
        return self.type_collector.declarations(nodes)

    def module_instances(self) -> list[JsonObject]:
        """Responsibilities: _module instances exposure collection_."""
        instances = self.instance_collector.collect()
        return [instance for instance in instances if "line" in instance]
