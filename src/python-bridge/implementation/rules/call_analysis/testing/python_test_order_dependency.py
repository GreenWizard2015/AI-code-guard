from __future__ import annotations

import ast
from collections.abc import Mapping, MutableMapping

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.rules.call_analysis.testing.python_binding_overlay import (
    PythonBindingOverlay,
)
from implementation.rules.call_analysis.testing.python_test_callable_definition import (
    PythonTestCallableDefinition,
)
from implementation.rules.call_analysis.testing.python_test_execution_region import (
    PythonTestExecutionRegion,
)
from implementation.rules.types import PythonTestMutationIndex
from implementation.types import JsonObject


class PythonTestOrderDependency:
    """Responsibilities: _shared mutable state detection_, _test order issue reporting_."""

    _mutation_methods: frozenset[str]
    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract

    def _mutable_value(self, value: ast.AST) -> bool:
        """Responsibilities: _module mutable value classification_."""
        if type(value) in (ast.List, ast.Dict, ast.Set):
            return True
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        return value.func.id in {"dict", "list", "set"}

    def _apply_assignment(
        self,
        node: ast.AST,
        bindings: MutableMapping[str, ast.AST],
    ) -> None:
        """Responsibilities: _mutable binding replacement_."""
        effects = PythonAssignmentEffects(node)
        if not effects.runtime_value_present():
            return
        value = effects.assigned_value()
        mutable = self._mutable_value(value)
        for name in effects.target_names():
            if mutable:
                bindings[name] = value
                continue
            if type(value) is ast.Name and value.id in bindings:
                bindings[name] = bindings[value.id]
                continue
            bindings.pop(name, None)

    def _append_shared_mutation(
        self,
        node: ast.Call,
        bindings: Mapping[str, ast.AST],
        shared_objects: set[ast.AST],
        writes: set[ast.AST],
    ) -> None:
        """Responsibilities: _shared mutation classification_."""
        if type(node.func) is not ast.Attribute:
            return
        owner = node.func.value
        if type(owner) is not ast.Name:
            return
        if node.func.attr not in self._mutation_methods:
            return
        if owner.id not in bindings:
            return
        identity = bindings[owner.id]
        if identity in shared_objects:
            writes.add(identity)

    def _test_writes(
        self,
        function: ast.AST,
        module_bindings: Mapping[str, ast.AST],
        shared_objects: set[ast.AST],
    ) -> set[ast.AST]:
        """Responsibilities: _shared mutation detection_."""
        definition = PythonTestCallableDefinition(function, self._node_index)
        callables = definition.nested_callables()
        region = PythonTestExecutionRegion(function, callables, self._node_index)
        bindings = PythonBindingOverlay(module_bindings)
        for name in region.local_names():
            bindings.pop(name, None)
        writes: set[ast.AST] = set()
        for node in region.nodes:
            if type(node) in (ast.Assign, ast.AnnAssign, ast.NamedExpr):
                self._apply_assignment(node, bindings)
            if type(node) is ast.Call:
                self._append_shared_mutation(node, bindings, shared_objects, writes)
        return writes

    def _test_mutations(
        self,
        module_bindings: Mapping[str, ast.AST],
    ) -> PythonTestMutationIndex:
        """Responsibilities: _test mutation counts_."""
        shared_objects = set(module_bindings.values())
        writes: PythonTestMutationIndex = {}
        for node in self._node_index.nodes(self._tree):
            if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
                test_name = node.name
            else:
                continue
            if not test_name.startswith("test_"):
                continue
            for identity in self._test_writes(node, module_bindings, shared_objects):
                writes.setdefault(identity, set()).add(node)
        return writes

    def __init__(self, tree: ast.Module, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _Python test-order dependency state_."""
        self._mutation_methods: frozenset[str] = frozenset(
            {"add", "append", "extend", "set", "update"},
        )
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index

    def module_mutable_objects(self) -> Mapping[str, ast.AST]:
        """Responsibilities: _module mutable objects_."""
        bindings: dict[str, ast.AST] = {}
        for statement in self._tree.body:
            self._apply_assignment(statement, bindings)
        return bindings

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _shared mutable test-state diagnostics_."""
        bindings = self.module_mutable_objects()
        object_names: dict[ast.AST, str] = {}
        for name, identity in bindings.items():
            object_names.setdefault(identity, name)
        return [
            {
                "line": 0,
                "kind": "test-order-dependency",
                "name": object_names[identity],
            }
            for identity, tests in self._test_mutations(bindings).items()
            if len(tests) > 1
        ]
