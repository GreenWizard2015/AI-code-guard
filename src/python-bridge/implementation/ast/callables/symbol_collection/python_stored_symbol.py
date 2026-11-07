from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonStoredSymbolContextContract,
)
from implementation.rules.constants import (
    PYTHON_CONSTANT_KIND,
    PYTHON_TYPE_ALIAS_DECLARATION_KIND,
    PYTHON_VARIABLE_KIND,
)
from implementation.types import JsonObject


class PythonStoredSymbol:
    """Responsibilities: _symbol declaration_, _symbol category_."""

    _context: PythonStoredSymbolContextContract

    def _parent(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _symbol parent node_."""
        parents = self._context.node_index().parents(node)
        if not parents:
            return self._context.tree()
        return parents[-1]

    def _type_alias(self) -> bool:
        """Responsibilities: _alias annotation kind_."""
        assignment = self._parent(self._node)
        if type(assignment) is ast.AnnAssign:
            return self._context.type_collector().type_alias_annotation(assignment.annotation)
        if type(assignment) is not ast.Assign:
            return False
        return self._assignment_alias(assignment)

    def _assignment_alias(self, assignment: ast.Assign) -> bool:
        """Responsibilities: _structural type aliases_."""
        if self._node.id.isupper():
            return False
        if not self.module_scope():
            return False
        if len(assignment.targets) != 1:
            return False
        if assignment.targets[0] is not self._node:
            return False
        return self._context.callable_arguments().structural_type(assignment.value)

    def _contract_field(self) -> bool:
        """Responsibilities: _contract field shape_."""
        assignment = self._parent(self._node)
        class_node = self._parent(assignment)
        if type(class_node) is not ast.ClassDef or not class_node.body:
            return False
        return all(type(item) is ast.AnnAssign for item in class_node.body)

    def __init__(self, node: ast.Name, context: PythonStoredSymbolContextContract) -> None:
        """Responsibilities: _symbol data initialization_."""
        self._node: ast.Name = node
        self._context = context

    def kind(self) -> str:
        """Responsibilities: _symbol category_."""
        if self._node.id.isupper():
            return PYTHON_CONSTANT_KIND
        assignment = self._parent(self._node)
        if type(assignment) is ast.Assign or type(assignment) is ast.AnnAssign:
            if type(self._parent(assignment)) is ast.ClassDef:
                return "field"
        return PYTHON_VARIABLE_KIND

    def module_scope(self) -> bool:
        """Responsibilities: _module symbol membership_."""
        current = self._parent(self._node)
        while current is not self._context.tree():
            if (
                type(current) is ast.FunctionDef
                or type(current) is ast.AsyncFunctionDef
                or type(current) is ast.ClassDef
            ):
                return False
            parents = self._context.node_index().parents(current)
            if not parents:
                return False
            current = parents[-1]
        return True

    def record(self) -> JsonObject:
        """Responsibilities: _symbol declaration data_."""
        kind = self.kind()
        module_scope = self.module_scope()
        return {
            "name": self._node.id,
            "line": self._node.lineno - 1,
            "kind": kind,
            "is_module_constant": kind == PYTHON_CONSTANT_KIND and module_scope,
            "is_module_variable": kind == PYTHON_VARIABLE_KIND and module_scope,
            "visibility": "public",
            "is_module_function": False,
        }

    def records(self) -> list[JsonObject]:
        """Responsibilities: _symbol declaration entries_."""
        if self._type_alias():
            return [
                {
                    "name": self._node.id,
                    "line": self._node.lineno - 1,
                    "kind": PYTHON_TYPE_ALIAS_DECLARATION_KIND,
                },
            ]
        if self._contract_field():
            return []
        return [self.record()]
