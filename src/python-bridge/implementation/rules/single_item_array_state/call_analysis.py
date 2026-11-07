from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonReferenceAliasesContract,
    PythonScopeAliasHistoryContract,
)
from implementation.rules.protocols import (
    PythonArrayTypeInspectorContract,
    PythonReturnArrayAnalyzerContract,
)
from implementation.rules.single_item_array_state.python_scope_alias_history import (
    PythonScopeAliasHistory,
)
from implementation.types import PythonAstCallableDeclarations, PythonAstNodeTypeSet


@dataclass(frozen=True)
class PythonArrayCallOptions:
    """Responsibilities: _array source_, _result contract_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    type_inspector: PythonArrayTypeInspectorContract
    return_analyzer: PythonReturnArrayAnalyzerContract
    assignment_aliases: PythonReferenceAliasesContract
    callable_declarations: PythonAstCallableDeclarations


class PythonArrayCallAnalyzer:
    """Responsibilities: _array results_, _callable aliases_."""

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
        if type(declaration) is ast.FunctionDef or type(declaration) is ast.AsyncFunctionDef:
            annotation = declaration.returns
        else:
            return False
        if annotation is None:
            return False
        if not self._type_inspector.array_type(annotation):
            return False
        return self._return_analyzer.single_arrays(declaration)

    def _array_value_name(self, indexed_expression: ast.Subscript) -> str:
        """Responsibilities: _resolution indexed callable alias_."""
        if type(indexed_expression.value) is ast.Call:
            if type(indexed_expression.value.func) is ast.Name:
                return indexed_expression.value.func.id
            return ""
        if type(indexed_expression.value) is ast.Name:
            return indexed_expression.value.id
        return ""

    def _resolved_aliases(self, target_values: dict[str, ast.AST]) -> dict[str, str]:
        """Responsibilities: _callable alias resolution_."""
        aliases: dict[str, str] = {}
        for name, value in target_values.items():
            target = self._value_name(value)
            if target:
                aliases[name] = target
        return aliases

    def __init__(self, options: PythonArrayCallOptions) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self._tree: ast.AST = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._type_inspector: PythonArrayTypeInspectorContract = options.type_inspector
        self._return_analyzer: PythonReturnArrayAnalyzerContract = options.return_analyzer
        self._reference_aliases: PythonReferenceAliasesContract = options.assignment_aliases
        self._callable_declarations_by_name: PythonAstCallableDeclarations = options.callable_declarations
        scope_types: PythonAstNodeTypeSet = {
            ast.Module,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.ClassDef,
        }
        self._scope_history: PythonScopeAliasHistoryContract = PythonScopeAliasHistory(
            self._node_index,
            scope_types,
            self,
        )

    def array_call_name(self, expression: ast.Subscript) -> str:
        """Responsibilities: _resolution function name usage_."""
        call_name = ""
        if type(expression.value) is ast.Call:
            call_name = self._call_name(expression.value)
        value_name = self._array_value_name(expression)
        if not value_name:
            return call_name
        resolution = self._scope_history.resolve(
            expression,
            value_name,
            expression.lineno,
        )
        if bool(resolution["found"]):
            return str(resolution["target"])
        return call_name

    def array_call(self, indexed_call: ast.Subscript) -> bool:
        """Responsibilities: _reporting indexing targets known_."""
        name = self.array_call_name(indexed_call)
        if not name:
            return False
        return any(self._is_array_declaration(declaration) for declaration in self._callable_declarations(name))

    def assignment_aliases(self, assignment: ast.AST) -> dict[str, str]:
        """Responsibilities: _resolution assignment callable aliases_."""
        if type(assignment) is ast.Assign:
            if len(assignment.targets) != 1:
                return {}
            target = assignment.targets[0]
            value = assignment.value
        else:
            if type(assignment) is not ast.AnnAssign or assignment.value is None:
                return {}
            target = assignment.target
            value = assignment.value
        if type(target) is ast.Name and type(value) is ast.Call:
            return {target.id: self._call_name(value)}
        target_values = self._reference_aliases.target_values(target, value)
        return self._resolved_aliases(target_values)
