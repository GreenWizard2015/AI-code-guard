from __future__ import annotations

import ast
from collections import deque
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_INIT_METHOD,
    PYTHON_MODULE_NAME_REASSIGNED,
    PYTHON_POST_INIT_METHOD,
)
from implementation.rules.protocols import (
    PythonNameBindingIndexContract,
    PythonStructuralMemberLookupContract,
)
from implementation.types import (
    JsonObject,
    PythonAssignmentsByCreation,
    PythonAstParentIndex,
    PythonMethodsByReceiver,
    PythonNameSetIndex,
)


@dataclass(frozen=True)
class PythonCallableScopeOptions:
    """Responsibilities: _callable scope analysis inputs_."""

    tree: ast.AST
    definition: ast.AST
    parents: PythonAstParentIndex
    contracts: PythonStructuralMemberLookupContract
    node_index: PythonAstNodeIndexContract
    binding_index: PythonNameBindingIndexContract


class PythonCallableScope:
    """Responsibilities: _callable node ownership_, _concrete collaborator analysis_."""

    _tree: ast.AST
    _definition: ast.AST
    _parents: PythonAstParentIndex
    _contracts: PythonStructuralMemberLookupContract
    _node_index: PythonAstNodeIndexContract
    _binding_index: PythonNameBindingIndexContract
    _nodes: list[ast.AST]
    _assignments_by_creation: PythonAssignmentsByCreation
    _methods_by_receiver: PythonMethodsByReceiver

    def _creation_class(self, value: ast.AST) -> str:
        """Responsibilities: _class identity for construction_."""
        if type(value) is ast.Call and type(value.func) is ast.Name:
            return value.func.id
        return ""

    def _contract_annotation(self, assignment: ast.AnnAssign) -> str:
        """Responsibilities: _contract annotation recognition_."""
        if type(assignment.target) is not ast.Name:
            return ""
        if type(assignment.annotation) is not ast.Name:
            return ""
        contract_name = assignment.annotation.id
        if not self._contracts.contains(contract_name):
            return ""
        return contract_name

    def _contract_binding_used(
        self,
        assignment_candidate: ast.AST,
        creation: ast.Call,
        implementations: PythonNameSetIndex,
    ) -> bool:
        """Responsibilities: _compatible contract method usage_."""
        if type(assignment_candidate) is not ast.AnnAssign:
            return False
        if assignment_candidate.value is not creation:
            return False
        contract_name = self._contract_annotation(assignment_candidate)
        if not contract_name:
            return False
        if contract_name not in implementations:
            return False
        if type(assignment_candidate.target) is not ast.Name:
            return False
        called_methods = self._methods_by_receiver.get(assignment_candidate.target.id, set())
        return not called_methods.isdisjoint(self._contracts.members(contract_name))

    def _contract_use(self, creation: ast.Call) -> bool:
        """Responsibilities: _contract-bound creation usage_."""
        implementations = self._contracts.implementation_contracts(
            self._creation_class(creation),
        )
        for assignment_candidate in self._assignments_by_creation.get(creation, []):
            if self._contract_binding_used(
                assignment_candidate,
                creation,
                implementations,
            ):
                return True
        return False

    def _creation_issue(self, call: ast.Call) -> JsonObject:
        """Responsibilities: _collaborator diagnostic creation_."""
        class_name = self._creation_class(call)
        if self._binding_index.function_binds(self._definition, class_name):
            return {}
        if self._binding_index.module_binding(class_name) == PYTHON_MODULE_NAME_REASSIGNED:
            return {}
        if not self._contract_use(call):
            return {}
        return {
            "line": call.lineno - 1,
            "kind": "concrete-collaborator-created-per-operation",
        }

    def _call_issue(self, call_candidate: ast.AST) -> JsonObject:
        """Responsibilities: _concrete collaborator call diagnostic_."""
        if type(call_candidate) is not ast.Call:
            return {}
        class_name = self._creation_class(call_candidate)
        if not self._contracts.implementation_contracts(class_name):
            return {}
        return self._creation_issue(call_candidate)

    def _ignored_method(self) -> bool:
        """Responsibilities: _construction lifecycle exclusion_."""
        definition = self._definition
        match definition:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                if definition.name in (
                    PYTHON_INIT_METHOD,
                    PYTHON_POST_INIT_METHOD,
                ):
                    return True
            case _:
                return True
        return type(self._parents.get(definition)) is not ast.ClassDef

    def _collect_nodes(self) -> None:
        """Responsibilities: _callable-owned AST node collection_."""
        pending: deque[ast.AST] = deque(self._node_index.children(self._definition))
        while pending:
            candidate = pending.popleft()
            self._nodes.append(candidate)
            if type(candidate) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                continue
            pending.extend(self._node_index.children(candidate))

    def _index_assignments(self) -> None:
        """Responsibilities: _annotated collaborator creation indexing_."""
        for candidate in self._nodes:
            if type(candidate) is ast.AnnAssign and type(candidate.value) is ast.Call:
                self._assignments_by_creation.setdefault(candidate.value, []).append(candidate)

    def _index_receiver_methods(self) -> None:
        """Responsibilities: _receiver method call indexing_."""
        for candidate in self._nodes:
            if type(candidate) is not ast.Call or type(candidate.func) is not ast.Attribute:
                continue
            if type(candidate.func.value) is ast.Name:
                receiver = candidate.func.value.id
                self._methods_by_receiver.setdefault(receiver, set()).add(candidate.func.attr)

    def __init__(self, options: PythonCallableScopeOptions) -> None:
        """Responsibilities: _callable analysis state setup_."""
        self._tree = options.tree
        self._definition = options.definition
        self._parents = options.parents
        self._contracts = options.contracts
        self._node_index = options.node_index
        self._binding_index = options.binding_index
        self._nodes = []
        self._assignments_by_creation = {}
        self._methods_by_receiver = {}

    def prepare(self) -> None:
        """Responsibilities: _callable-owned AST indexing_."""
        self._nodes.clear()
        self._nodes.append(self._definition)
        self._collect_nodes()
        self._index_assignments()
        self._index_receiver_methods()

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _callable collaborator diagnostics_."""
        self.prepare()
        if self._ignored_method():
            return []
        for candidate in self._nodes:
            issue = self._call_issue(candidate)
            if issue:
                return [issue]
        return []
