from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import PythonCallableAstNode

CollectionOwnerLines = dict[str, set[int]]


class PythonCollectionMutationAnalysis:
    """Responsibilities: _collection mutation detection_, _module owner aggregation_."""

    def _nested_callable(self, node: ast.AST, callable_root: ast.AST) -> bool:
        """Responsibilities: _nested callable boundary_."""
        if node is callable_root:
            return False
        return type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)

    def _mutating_call_owner(self, call: ast.Call) -> str:
        """Responsibilities: _mutating call collection owner_."""
        if type(call.func) is not ast.Attribute:
            return ""
        owner = call.func.value
        if type(owner) is not ast.Name or call.func.attr not in self._mutators:
            return ""
        return owner.id

    def _assigned_collection_name(self, assignment: ast.Assign) -> str:
        """Responsibilities: _assigned collection mutation_."""
        for target in assignment.targets:
            if type(target) is ast.Subscript and type(target.value) is ast.Name:
                if target.value.id in self._collections:
                    return target.value.id
            if type(target) is ast.Name and target.id in self._collections:
                if target.id in self._global_names:
                    return target.id
        return ""

    def _mutated_name(self, expression_node: ast.AST) -> str:
        """Responsibilities: _collection mutation name_."""
        if type(expression_node) is ast.Call:
            owner = self._mutating_call_owner(expression_node)
            if owner in self._collections:
                return owner
        if type(expression_node) is ast.Assign:
            return self._assigned_collection_name(expression_node)
        return ""

    def _visit(self, current_node: ast.AST, callable_root: ast.AST) -> None:
        """Responsibilities: _collection mutation traversal_."""
        if self._nested_callable(current_node, callable_root):
            return
        if type(current_node) is ast.Global:
            self._global_names.update(current_node.names)
        mutated_name = self._mutated_name(current_node)
        if mutated_name:
            self._mutations.add(mutated_name)
        for child in self._node_index.children(current_node):
            self._visit(child, callable_root)

    def __init__(
        self,
        collections: dict[str, int],
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _collection mutation analysis inputs_."""
        self._collections: dict[str, int] = collections
        self._node_index: PythonAstNodeIndexContract = node_index
        self._mutators: frozenset[str] = frozenset(
            {"add", "clear", "discard", "extend", "pop", "remove", "set", "update"},
        )
        self._global_names: set[str] = set()
        self._mutations: set[str] = set()

    def mutations(self, callable_node: PythonCallableAstNode) -> set[str]:
        """Responsibilities: _callable collection mutations_."""
        self._global_names.clear()
        self._mutations.clear()
        self._visit(callable_node, callable_node)
        return set(self._mutations)

    def owners(self, callables: list[PythonCallableAstNode]) -> CollectionOwnerLines:
        """Responsibilities: _collection mutation owners_."""
        owners: CollectionOwnerLines = {name: set() for name in self._collections}
        for callable_node in callables:
            for name in self.mutations(callable_node):
                owners[name].add(callable_node.lineno)
        return owners
