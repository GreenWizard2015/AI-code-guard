from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.python_name_binding_index import PythonNameBindingIndex
from implementation.rules.call_analysis.python_structural_member_index import (
    PythonStructuralMemberIndex,
)
from implementation.rules.constants import (
    PYTHON_ISINSTANCE_FUNCTION,
    PYTHON_MODULE_NAME_ABSENT,
)
from implementation.rules.protocols import PythonNameBindingIndexContract
from implementation.types import JsonObject, PythonAstParentIndex


@dataclass(frozen=True)
class PythonImplementationDowncastCandidate:
    """Responsibilities: _Protocol downcast candidate identity_."""

    callable_scope: ast.AST
    receiver_name: str
    implementation_name: str


class PythonImplementationDowncast:
    """Responsibilities: _Protocol downcast analysis_, _implementation member detection_."""

    _tree: ast.AST
    _parents: PythonAstParentIndex
    _contracts: PythonStructuralMemberIndex
    _node_index: PythonAstNodeIndexContract
    _binding_index: PythonNameBindingIndexContract

    def _function(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _nearest callable lookup_."""
        current = self._parents.get(node)
        while current is not None:
            match current:
                case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.Lambda():
                    return current
            current = self._parents.get(current)
        return self._tree

    def _argument_protocol(self, callable_scope: ast.AST, receiver_name: str) -> str:
        """Responsibilities: _callable Protocol parameter lookup_."""
        match callable_scope:
            case ast.FunctionDef(args=arguments) | ast.AsyncFunctionDef(args=arguments) | ast.Lambda(args=arguments):
                pass
            case _:
                return ""
        parameters = arguments.posonlyargs + arguments.args + arguments.kwonlyargs
        for argument in parameters:
            if argument.arg != receiver_name or argument.annotation is None:
                continue
            protocol = argument.annotation
            if type(protocol) is not ast.Name:
                continue
            if self._contracts.contains(protocol.id):
                return protocol.id
        return ""

    def _matches_implementation_member(
        self,
        node: ast.AST,
        receiver: str,
        methods: set[str],
    ) -> bool:
        """Responsibilities: _implementation member identity_."""
        if type(node) is not ast.Call or type(node.func) is not ast.Attribute:
            return False
        if type(node.func.value) is not ast.Name or node.func.value.id != receiver:
            return False
        return node.func.attr not in methods

    def _implementation_member_call(
        self,
        branch: ast.AST,
        receiver: str,
        methods: set[str],
    ) -> bool:
        """Responsibilities: _implementation-specific method references_."""
        owner = self._function(branch)
        if owner is self._tree:
            return False
        for node in ast.walk(branch):
            if self._function(node) is not owner:
                continue
            if self._matches_implementation_member(node, receiver, methods):
                return True
        return False

    def _is_candidate(self, call: ast.AST) -> bool:
        """Responsibilities: _isinstance branch lookup_."""
        if type(call) is not ast.Call or len(call.args) < 2:
            return False
        if type(call.func) is not ast.Name or call.func.id != PYTHON_ISINSTANCE_FUNCTION:
            return False
        branch = self._parents.get(call)
        return type(branch) is ast.If and branch.test is call

    def _bindings_allow_downcast(
        self,
        candidate: PythonImplementationDowncastCandidate,
    ) -> bool:
        """Responsibilities: _downcast name binding validation_."""
        if self._binding_index.function_binds(
            candidate.callable_scope,
            PYTHON_ISINSTANCE_FUNCTION,
        ):
            return False
        if self._binding_index.module_binding(PYTHON_ISINSTANCE_FUNCTION) != PYTHON_MODULE_NAME_ABSENT:
            return False
        return not self._binding_index.function_binds(
            candidate.callable_scope,
            candidate.implementation_name,
        )

    def _candidate_protocol(
        self,
        candidate: PythonImplementationDowncastCandidate,
    ) -> str:
        """Responsibilities: _candidate Protocol resolution_."""
        if not self._bindings_allow_downcast(candidate):
            return ""
        protocol = self._argument_protocol(candidate.callable_scope, candidate.receiver_name)
        implementations = self._contracts.implementation_contracts(
            candidate.implementation_name,
        )
        if protocol not in implementations:
            return ""
        return protocol

    def _implementation_downcast(self, call: ast.Call, branch: ast.AST) -> bool:
        """Responsibilities: _implementation downcast analysis_."""
        match call.args[:2]:
            case [ast.Name(id=receiver_name), ast.Name(id=implementation_name)]:
                pass
            case _:
                return False
        downcast_candidate = PythonImplementationDowncastCandidate(
            self._function(branch),
            receiver_name,
            implementation_name,
        )
        protocol = self._candidate_protocol(downcast_candidate)
        if not protocol:
            return False
        methods = self._contracts.members(protocol)
        return self._implementation_member_call(branch, receiver_name, methods)

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _analysis state initialization_."""
        self._tree = tree
        self._parents = {}
        self._node_index = node_index
        self._contracts = PythonStructuralMemberIndex(tree, node_index)
        self._binding_index = PythonNameBindingIndex(tree, node_index)

    def prepare(self) -> None:
        """Responsibilities: _AST parent indexing_."""
        if type(self._tree) is not ast.Module:
            return
        self._contracts.prepare()
        self._binding_index.index_tree()
        for parent in self._node_index.nodes(self._tree):
            for child in self._node_index.children(parent):
                self._parents.update({child: parent})

    def issue(self, call: ast.AST) -> JsonObject:
        """Responsibilities: _Protocol downcast diagnosis_."""
        if type(call) is not ast.Call:
            return {}
        if not self._is_candidate(call):
            return {}
        branch = self._parents[call]
        if not self._implementation_downcast(call, branch):
            return {}
        return {"line": call.lineno - 1, "kind": "protocol-downcast-to-implementation"}
