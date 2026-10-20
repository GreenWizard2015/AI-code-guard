from __future__ import annotations

import ast
from typing import FrozenSet

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonHiddenGlobalStateRules:
    """Responsibilities: _module collection discovery_, _callable mutation tracking_."""

    def _target_name(self, target: ast.AST) -> str:
        """Responsibilities: _collection target naming_."""
        if type(target) is ast.Name:
            return target.id
        return ""

    def _collection_value(self, value: ast.AST) -> bool:
        """Responsibilities: _collection initializer classification_."""
        if value is None:
            return False
        if type(value) is ast.List:
            return True
        if type(value) is ast.Dict:
            return True
        if type(value) is ast.Set:
            return True
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        return value.func.id in self._collection_calls

    def _statement_collections(self, statement: ast.stmt) -> dict[str, int]:
        """Responsibilities: _module collection statement extraction_."""
        collections: dict[str, int] = {}
        if type(statement) is ast.Assign:
            return self._assignment_collections(statement)
        if type(statement) is ast.AnnAssign:
            return self._annotated_collection(statement)
        return collections

    def _assignment_collections(self, statement: ast.Assign) -> dict[str, int]:
        """Responsibilities: _assignment collection extraction_."""
        collections: dict[str, int] = {}
        for target in statement.targets:
            name = self._target_name(target)
            if not name:
                continue
            if self._collection_value(statement.value):
                collections[name] = statement.lineno - 1
        return collections

    def _annotated_collection(self, statement: ast.AnnAssign) -> dict[str, int]:
        """Responsibilities: _annotated collection extraction_."""
        name = self._target_name(statement.target)
        if not name:
            return {}
        if statement.value is None:
            return {}
        if not self._collection_value(statement.value):
            return {}
        return {name: statement.lineno - 1}

    def _nested_callable(self, current: ast.AST, node: ast.AST) -> bool:
        """Responsibilities: _nested callable boundary detection_."""
        if current is node:
            return False
        return type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)

    def _call_mutated_name(self, current: ast.AST, collections: dict[str, int]) -> str:
        """Responsibilities: _collection mutation_."""
        if type(current) is not ast.Call:
            return ""
        if type(current.func) is not ast.Attribute:
            return ""
        owner = current.func.value
        if type(owner) is not ast.Name:
            return ""
        if owner.id not in collections or current.func.attr not in self._mutators:
            return ""
        return owner.id

    def _assignment_mutated_name(
        self,
        current: ast.Assign,
        collections: dict[str, int],
        global_names: set[str],
    ) -> str:
        """Responsibilities: _collection assignment mutation_."""
        for target in current.targets:
            if type(target) is ast.Subscript:
                if type(target.value) is ast.Name and target.value.id in collections:
                    return target.value.id
            if type(target) is ast.Name:
                if target.id in collections and target.id in global_names:
                    return target.id
        return ""

    def _mutated_name(
        self,
        current: ast.AST,
        collections: dict[str, int],
        global_names: set[str],
    ) -> str:
        """Responsibilities: _collection mutation classification_."""
        call_name = self._call_mutated_name(current, collections)
        if call_name:
            return call_name
        if type(current) is not ast.Assign:
            return ""
        return self._assignment_mutated_name(current, collections, global_names)

    def _callable_mutations(
        self, node: ast.AST, collections: dict[str, int]
    ) -> set[str]:
        """Responsibilities: _callable collection mutation lookup_."""
        global_names: set[str] = set()
        mutations: set[str] = set()

        def visit(current: ast.AST) -> None:
            """Responsibilities: _collection mutation traversal_."""
            if self._nested_callable(current, node):
                return
            if type(current) is ast.Global:
                global_names.update(current.names)
            mutated_name = self._mutated_name(current, collections, global_names)
            if mutated_name:
                mutations.add(mutated_name)
            for child in self._node_index.children(current):
                visit(child)

        visit(node)
        return mutations

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _hidden state rule initialization_."""
        self._rule_id: str = "hidden-global-state"
        self._node_index: PythonAstNodeIndexContract = node_index
        self._mutators: FrozenSet[str] = frozenset(
            {"add", "clear", "discard", "extend", "pop", "remove", "set", "update"}
        )
        self._collection_calls: FrozenSet[str] = frozenset({"dict", "list", "set"})

    def collections(self, tree: ast.Module) -> dict[str, int]:
        """Responsibilities: _shared module collection selection_."""
        collections: dict[str, int] = {}
        for statement in tree.body:
            collections.update(self._statement_collections(statement))
        return collections

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _shared module collection reporting_."""
        collections = self.collections(tree)
        owners: dict[str, set[int]] = {name: set() for name in collections}
        callables = [
            node
            for node in self._node_index.nodes(tree)
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
        ]
        for node in callables:
            mutations = self._callable_mutations(node, collections)
            for name in collections:
                if name in mutations:
                    owners[name].add(node.lineno)
        return [
            {"line": collections[name], "kind": self._rule_id, "name": name}
            for name, callable_owners in owners.items()
            if len(callable_owners) > 1
        ]
