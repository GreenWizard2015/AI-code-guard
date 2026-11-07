from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.coding_issues.python_collection_mutation_analysis import (
    PythonCollectionMutationAnalysis,
)
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

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _hidden state rule initialization_."""
        self._rule_id: str = "hidden-global-state"
        self._node_index: PythonAstNodeIndexContract = node_index
        self._collection_calls: frozenset[str] = frozenset({"dict", "list", "set"})

    def collections(self, tree: ast.Module) -> dict[str, int]:
        """Responsibilities: _shared module collection selection_."""
        collections: dict[str, int] = {}
        for statement in tree.body:
            collections.update(self._statement_collections(statement))
        return collections

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _shared module collection reporting_."""
        collections = self.collections(tree)
        callables = [
            node for node in self._node_index.nodes(tree) if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
        ]
        mutation_analysis = PythonCollectionMutationAnalysis(
            collections,
            self._node_index,
        )
        owners = mutation_analysis.owners(callables)
        return [
            {"line": collections[name], "kind": self._rule_id, "name": name}
            for name, callable_owners in owners.items()
            if len(callable_owners) > 1
        ]
