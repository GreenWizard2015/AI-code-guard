from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from implementation.protocols import (
    PythonScopeAliasHistoryContract,
    PythonArrayTypeInspectorContract,
    PythonAstNodeIndexContract,
    PythonReturnArrayAnalyzerContract,
)
from implementation.references.aliases.protocols import PythonReferenceAliasesContract
from implementation.rules.single_item_array_state.python_scope_alias_history import (
    PythonScopeAliasHistory,
)
from implementation.types import OperatorTypes


@dataclass(frozen=True)
class PythonArrayCallOptions:
    """Responsibilities: _array source_, _result contract_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    type_inspector: PythonArrayTypeInspectorContract
    return_analyzer: PythonReturnArrayAnalyzerContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonArrayCallAnalyzer:
    """Responsibilities: _array results_, _callable aliases_."""

    def _assignment_target_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _resolution assignment reference targets_."""
        if type(node) is ast.Assign and len(node.targets) == 1:
            return self.reference_aliases.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            return self.reference_aliases.target_values(node.target, node.value)
        return {}

    def _direct_call_alias(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _resolution direct callable aliases_."""
        if type(node) is ast.Assign and len(node.targets) == 1:
            target = node.targets[0]
            if type(target) is ast.Name and type(node.value) is ast.Call:
                return {target.id: self._call_name(node.value)}
        if type(node) is ast.AnnAssign and type(node.target) is ast.Name:
            if type(node.value) is ast.Call:
                return {node.target.id: self._call_name(node.value)}
        return {}

    def _value_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution alias target names_."""
        if type(value) is ast.Call:
            return self._call_name(value)
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def _call_name(self, node: ast.Call) -> str:
        """Responsibilities: _resolution invocation function name_."""
        if type(node.func) is ast.Name:
            return node.func.id
        if type(node.func) is ast.Attribute:
            return node.func.attr
        return ""

    def _callable_declarations(self, name: str) -> list[ast.AST]:
        """Responsibilities: _collection callable declarations matching_."""
        if name not in self._callable_declarations_by_name:
            return []
        return self._callable_declarations_by_name[name]

    def _is_array_declaration(self, declaration: ast.AST) -> bool:
        """Responsibilities: _classification callable output array-like_."""
        if declaration.returns is None:
            return False
        if not self.type_inspector.array_type(declaration.returns):
            return False
        return self.return_analyzer.single_arrays(declaration)

    def _array_value_name(self, node: ast.Subscript) -> str:
        """Responsibilities: _resolution indexed callable alias_."""
        if type(node.value) is ast.Call:
            if type(node.value.func) is ast.Name:
                return node.value.func.id
            return ""
        if type(node.value) is ast.Name:
            return node.value.id
        return ""

    def _prepare_indexes(self) -> None:
        """Responsibilities: _declaration and assignment indexes_."""
        if self._indexes_prepared:
            return
        for node in self.node_index.nodes(self.tree):
            if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            declarations = self._callable_declarations_by_name.setdefault(node.name, [])
            declarations.append(node)
        self._indexes_prepared.add("ready")

    def __init__(self, options: PythonArrayCallOptions) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self.tree: Any = options.tree
        self.node_index: Any = options.node_index
        self.type_inspector: PythonArrayTypeInspectorContract = options.type_inspector
        self.return_analyzer: PythonReturnArrayAnalyzerContract = (
            options.return_analyzer
        )
        self.reference_aliases: PythonReferenceAliasesContract = (
            options.assignment_aliases
        )
        scope_types: OperatorTypes = {
            ast.Module,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.ClassDef,
        }
        self._callable_declarations_by_name: dict[str, list[ast.AST]] = {}
        self._scope_history: PythonScopeAliasHistoryContract = PythonScopeAliasHistory(
            self.node_index,
            scope_types,
            self,
        )
        self._indexes_prepared: set[str] = set()

    def array_call_name(self, node: ast.Subscript) -> str:
        """Responsibilities: _resolution function name usage_."""
        self._prepare_indexes()
        call_name = ""
        if type(node.value) is ast.Call:
            call_name = self._call_name(node.value)
        value_name = self._array_value_name(node)
        if not value_name:
            return call_name
        resolution = self._scope_history.resolve(node, value_name, node.lineno)
        if bool(resolution["found"]):
            return str(resolution["target"])
        return call_name

    def array_call(self, node: ast.Subscript) -> bool:
        """Responsibilities: _reporting indexing targets known_."""
        name: Any = self.array_call_name(node)
        if not name:
            return False
        return any(
            self._is_array_declaration(declaration)
            for declaration in self._callable_declarations(name)
        )

    def assignment_aliases(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _resolution assignment callable aliases_."""
        direct_alias = self._direct_call_alias(node)
        if direct_alias:
            return direct_alias
        target_values = self._assignment_target_values(node)
        aliases: dict[str, str] = {}
        for name, value in target_values.items():
            target = self._value_name(value)
            if target:
                aliases[name] = target
        return aliases
