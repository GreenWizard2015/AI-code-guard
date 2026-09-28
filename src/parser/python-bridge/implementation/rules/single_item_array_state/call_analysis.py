from __future__ import annotations
from typing import Any

import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.protocols import PythonReferenceAliasesProtocol
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.rules.protocols import (
    PythonArrayTypeInspectorProtocol,
    PythonReturnArrayAnalyzerProtocol,
)


class PythonArrayCallAnalyzer:
    """Responsibilities: _Python array result detection_."""

    def _scope_chain(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection enclosing scopes_."""
        scopes: list[ast.AST] = []
        current: Any = node
        while True:
            parents: Any = self.node_index.parents(current)
            if not parents:
                return scopes
            parent: Any = parents[0]
            if type(parent) in self.scope_types:
                scopes.append(parent)
            current = parent

    def _assignment_aliases(self, node: ast.AST) -> dict[str, str]:
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

    def _assignment_target_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _resolution assignment reference targets_."""
        if type(node) is ast.Assign and len(node.targets) == 1:
            return self.assignment_aliases.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            return self.assignment_aliases.target_values(node.target, node.value)
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

    def _scope_assignments(self, scope: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection scoped assignments_."""
        assignments = []
        for item in self.node_index.nodes(scope):
            if type(item) not in (ast.Assign, ast.AnnAssign):
                continue
            if self._scope_chain(item)[:1] == [scope]:
                assignments.append(item)
        return sorted(assignments, key=lambda item: (item.lineno, item.col_offset))

    def _scope_aliases(self, scope: ast.AST, line: int) -> dict[str, str]:
        """Responsibilities: _scoped target aliases_."""
        aliases: dict[str, str] = {}
        for item in self._scope_assignments(scope):
            if item.lineno > line:
                continue
            aliases.update(self._assignment_aliases(item))
        return aliases

    def _resolve_alias(self, name: str, aliases: dict[str, str]) -> str:
        """Responsibilities: _alias chain targets_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases and resolved not in seen:
            seen.add(resolved)
            resolved = aliases[resolved]
        return resolved

    def _call_name(self, node: ast.Call) -> str:
        """Responsibilities: _resolution invocation function name_."""
        if type(node.func) is ast.Name:
            return node.func.id
        if type(node.func) is ast.Attribute:
            return node.func.attr
        return ""

    def _callable_declarations(self, name: str) -> list[ast.AST]:
        """Responsibilities: _collection callable declarations matching_."""
        return [
            node
            for node in self.node_index.nodes(self.tree)
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
            and node.name == name
        ]

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

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexProtocol,
        type_inspector: PythonArrayTypeInspectorProtocol,
        return_analyzer: PythonReturnArrayAnalyzerProtocol,
    ) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.type_inspector: PythonArrayTypeInspectorProtocol = type_inspector
        self.return_analyzer: PythonReturnArrayAnalyzerProtocol = return_analyzer
        self.assignment_aliases: PythonReferenceAliasesProtocol = (
            PythonReferenceAliases()
        )
        self.scope_types: Any = {
            ast.Module,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.ClassDef,
        }

    def array_call_name(self, node: ast.Subscript) -> str:
        """Responsibilities: _resolution function name usage_."""
        call_name = ""
        if type(node.value) is ast.Call:
            call_name = self._call_name(node.value)
        value_name = self._array_value_name(node)
        if not value_name:
            return call_name
        self.node_index.nodes(self.tree)
        for scope in self._scope_chain(node):
            aliases = self._scope_aliases(scope, node.lineno)
            resolved = self._resolve_alias(value_name, aliases)
            if resolved != value_name or value_name in aliases:
                return resolved
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
