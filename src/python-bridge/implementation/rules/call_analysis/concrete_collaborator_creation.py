from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.python_callable_scope import (
    PythonCallableScope,
    PythonCallableScopeOptions,
)
from implementation.rules.call_analysis.python_name_binding_index import PythonNameBindingIndex
from implementation.rules.call_analysis.python_structural_member_index import (
    PythonStructuralMemberIndex,
)
from implementation.rules.protocols import PythonNameBindingIndexContract, PythonStructuralMemberLookupContract
from implementation.types import JsonObject, PythonAstParentIndex


class ConcreteCollaboratorCreation:
    """Responsibilities: _project contract indexing_, _per-operation creation detection_."""

    _tree: ast.AST
    _parents: PythonAstParentIndex
    _contracts: PythonStructuralMemberLookupContract
    _node_index: PythonAstNodeIndexContract
    _binding_index: PythonNameBindingIndexContract

    def _function_issues(self, definition: ast.AST) -> list[JsonObject]:
        """Responsibilities: _callable collaborator diagnostics_."""
        match definition:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                pass
            case _:
                return []
        scope = PythonCallableScope(
            PythonCallableScopeOptions(
                self._tree,
                definition,
                self._parents,
                self._contracts,
                self._node_index,
                self._binding_index,
            ),
        )
        return scope.issues()

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _analysis state setup_."""
        self._tree = tree
        self._parents = {}
        self._node_index = node_index
        self._contracts: PythonStructuralMemberLookupContract = PythonStructuralMemberIndex(tree, node_index)
        self._binding_index = PythonNameBindingIndex(tree, node_index)

    def prepare(self) -> None:
        """Responsibilities: _source contract indexing_."""
        self._contracts.prepare()
        self._binding_index.index_tree()
        for parent in self._node_index.nodes(self._tree):
            for child in self._node_index.children(parent):
                self._parents.update({child: parent})

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _per-operation collaborator diagnostics_."""
        issues: list[JsonObject] = []
        for definition in self._node_index.nodes(self._tree):
            issues.extend(self._function_issues(definition))
        return issues
