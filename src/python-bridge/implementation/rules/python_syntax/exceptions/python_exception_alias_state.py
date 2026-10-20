from __future__ import annotations

import ast

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.references.protocols import PythonExceptionAliasSnapshotContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)


class PythonExceptionAliasState:
    """Responsibilities: _exception aliases_, _assignment aliases_."""

    def _assignment_name(self, value: ast.AST) -> str:
        """Responsibilities: _assigned exception name_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        if type(value) is ast.Subscript:
            resolved = self.container_values.container_value(value)
            if resolved.found():
                return self._assignment_name(resolved.expression_node())
        return ""

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _exception alias assignments_."""
        for target in targets:
            for target_name, target_value in self.assignment_aliases.target_values(
                target, value, references_only=False
            ).items():
                name = self._assignment_name(target_value)
                self.broadness.observe_alias(
                    name, target_name, self.broadness.broad(target_value)
                )

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _exception assignment aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            self.multiplicity.configure(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)
        self.multiplicity.configure([node.target], node.value)

    def _capture(self, node: ast.AST) -> None:
        """Responsibilities: _lexical exception binding snapshots_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
            outer = self.broadness.snapshot(frozenset(self.multi_exception_names))
            for statement in node.body:
                self._capture(statement)
            outer.restore(self.broadness, self.multi_exception_names)
            return
        if type(node) in (ast.Try, ast.TryStar):
            self.handler_states[node] = self.broadness.snapshot(
                frozenset(self.multi_exception_names)
            )
        self.observe(node)
        for child in ast.iter_child_nodes(node):
            self._capture(child)

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        broadness: PythonExceptionBroadnessContract,
        container_values: PythonContainerValuesContract,
        multiplicity: PythonExceptionMultiplicityContract,
    ) -> None:
        """Responsibilities: _initialization exception aliases_."""
        self.multiplicity: PythonExceptionMultiplicityContract = multiplicity
        self.assignment_aliases: PythonReferenceAliasesContract = multiplicity.aliases()
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.broadness: PythonExceptionBroadnessContract = broadness
        self.container_values: PythonContainerValuesContract = container_values
        self.multi_exception_names: set[str] = multiplicity.names()
        self.handler_states: dict[ast.AST, PythonExceptionAliasSnapshotContract] = {}

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _exception alias configuration_."""
        if type(tree) is not ast.Module:
            return
        self.container_aliases.clear()
        self.handler_states.clear()
        for node in tree.body:
            self._capture(node)

    def select(self, node: ast.AST) -> None:
        """Responsibilities: _handler exception alias state_."""
        state = self.handler_states.get(node)
        if state is not None:
            state.restore(self.broadness, self.multi_exception_names)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _exception alias observation_."""
        self.container_aliases.observe(node)
        self.broadness.observe(node)
        self._configure_assignment(node)
