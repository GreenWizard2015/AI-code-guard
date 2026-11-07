from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonExceptionAliasSnapshotContract,
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
            resolved = self._container_values.container_value(value)
            if resolved.found():
                return self._assignment_name(resolved.expression_node())
        return ""

    def _configure_assignment_targets(
        self,
        targets: Sequence[ast.AST],
        value: ast.AST,
    ) -> None:
        """Responsibilities: _exception alias assignments_."""
        for target in targets:
            for target_name, target_value in self._assignment_aliases.target_values(
                target,
                value,
                references_only=False,
            ).items():
                name = self._assignment_name(target_value)
                self._broadness.observe_alias(
                    name,
                    target_name,
                    self._broadness.broad(target_value),
                )
        self._multiplicity.configure(list(targets), value)

    def _configure_assignment(self, assignment: ast.AST) -> None:
        """Responsibilities: _exception assignment aliases_."""
        if type(assignment) is ast.Assign:
            self._configure_assignment_targets(assignment.targets, assignment.value)
            return
        if type(assignment) is ast.AnnAssign:
            if assignment.value is not None:
                self._configure_assignment_targets(
                    [assignment.target],
                    assignment.value,
                )

    def _capture_scope(self, statements: list[ast.stmt]) -> None:
        """Responsibilities: _lexical exception binding snapshots_."""
        multiple_names = self._multiplicity.names()
        outer = self._broadness.snapshot(frozenset(multiple_names))
        for statement in statements:
            self._capture(statement)
        outer.restore(self._broadness, multiple_names)
        self._multiplicity.restore_names(multiple_names)

    def _capture_nested_scope(self, syntax_node: ast.AST) -> bool:
        """Responsibilities: _nested scope snapshots_."""
        match syntax_node:
            case (
                ast.FunctionDef(body=statements) | ast.AsyncFunctionDef(body=statements) | ast.ClassDef(body=statements)
            ):
                self._capture_scope(statements)
                return True
            case _:
                return False

    def _capture(self, syntax_node: ast.AST) -> None:
        """Responsibilities: _exception alias traversal_."""
        if self._capture_nested_scope(syntax_node):
            return
        if type(syntax_node) in (ast.Try, ast.TryStar):
            multiple_names = frozenset(self._multiplicity.names())
            self._handler_states.update({syntax_node: self._broadness.snapshot(multiple_names)})
        if type(syntax_node) in (ast.Import, ast.ImportFrom, ast.Assign, ast.AnnAssign):
            self.observe(syntax_node)
        for child in self._container_aliases.state().node_index().children(syntax_node):
            self._capture(child)

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        broadness: PythonExceptionBroadnessContract,
        container_values: PythonContainerValuesContract,
        multiplicity: PythonExceptionMultiplicityContract,
    ) -> None:
        """Responsibilities: _initialization exception aliases_."""
        self._multiplicity: PythonExceptionMultiplicityContract = multiplicity
        self._assignment_aliases: PythonReferenceAliasesContract = multiplicity.aliases()
        self._container_aliases: PythonContainerAliasesContract = container_aliases
        self._broadness: PythonExceptionBroadnessContract = broadness
        self._container_values: PythonContainerValuesContract = container_values
        self._handler_states: dict[ast.AST, PythonExceptionAliasSnapshotContract] = {}

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _exception alias configuration_."""
        if type(tree) is not ast.Module:
            return
        self._container_aliases.clear()
        self._handler_states.clear()
        for node in tree.body:
            self._capture(node)

    def select(self, try_statement: ast.AST) -> None:
        """Responsibilities: _handler exception alias state_."""
        state = self._handler_states.get(try_statement)
        if state is not None:
            multiple_names = self._multiplicity.names()
            state.restore(self._broadness, multiple_names)
            self._multiplicity.restore_names(multiple_names)

    def observe(self, observed_node: ast.AST) -> None:
        """Responsibilities: _exception alias observation_."""
        self._container_aliases.observe(observed_node)
        self._broadness.observe(observed_node)
        self._configure_assignment(observed_node)
