from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_FIELD_READ_EFFECT,
    PYTHON_FIELD_READ_EFFECTS,
    PYTHON_FIELD_READ_WRITE_EFFECTS,
    PYTHON_FIELD_WRITE_EFFECT,
    PYTHON_FIELD_WRITE_EFFECTS,
)
from implementation.rules.control_flow.python_method_record_value import (
    PythonMethodRecordValue,
)
from implementation.rules.protocols import PythonMethodRecordContract
from implementation.types import PythonCallableAstNode


@dataclass(frozen=True, order=True)
class SourcePosition:
    """Responsibilities: _source position_, _position ordering_."""

    line: int
    column: int


FieldAccessMap = dict[str, set[str]]


class PythonTemporalAccess:
    """Responsibilities: _method field access_, _field access effects_."""

    def _assignment_effects(
        self,
        assignment_target: ast.AST,
        parent: ast.Assign,
    ) -> frozenset[str]:
        """Responsibilities: _assignment access roles_."""
        if any(target is assignment_target for target in parent.targets):
            return PYTHON_FIELD_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def _annotation_assignment_effects(
        self,
        annotated_target: ast.AST,
        parent: ast.AnnAssign,
    ) -> frozenset[str]:
        """Responsibilities: _annotated assignment access roles_."""
        if parent.target is annotated_target:
            if parent.value is None:
                return frozenset()
            return PYTHON_FIELD_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def _assignment_targets(self, statement: ast.stmt) -> list[ast.expr]:
        """Responsibilities: _assignment target selection_."""
        if type(statement) is ast.Assign:
            return statement.targets
        if type(statement) is ast.AnnAssign:
            return [statement.target]
        if type(statement) is ast.AugAssign:
            return [statement.target]
        return []

    def _receiver_reassigned(self, statement: ast.stmt) -> bool:
        """Responsibilities: _receiver assignment targets_."""
        return any(
            type(target_node) is ast.Name and target_node.id == "self" and type(target_node.ctx) is ast.Store
            for target in self._assignment_targets(statement)
            for target_node in ast.walk(target)
        )

    def _first_receiver_boundary(
        self,
        arguments: ast.arguments,
        body: list[ast.stmt],
    ) -> list[SourcePosition]:
        """Responsibilities: _receiver rebinding boundaries_."""
        parameters = arguments.posonlyargs
        if len(parameters) == 0:
            parameters = arguments.args
        if len(parameters) == 0 or parameters[0].arg != "self":
            return []
        for statement in body:
            if not self._receiver_reassigned(statement):
                continue
            if statement.end_lineno is None or statement.end_col_offset is None:
                continue
            return [SourcePosition(statement.end_lineno, statement.end_col_offset)]
        return []

    def _append_field_access(
        self,
        current: ast.AST,
        boundaries: list[SourcePosition],
        accesses: FieldAccessMap,
    ) -> None:
        """Responsibilities: _method field access roles_."""
        field = self.field_name(current)
        if field and boundaries and type(current) is ast.Attribute:
            access_position = SourcePosition(current.lineno, current.col_offset)
            if any(boundary < access_position for boundary in boundaries):
                return
        if not field:
            return
        effects = self.field_access_effects(current)
        if PYTHON_FIELD_WRITE_EFFECT in effects:
            accesses["writes"].add(field)
        if PYTHON_FIELD_READ_EFFECT in effects:
            accesses["reads"].add(field)

    def _append_accesses(
        self,
        current: ast.AST,
        boundaries: list[SourcePosition],
        accesses: FieldAccessMap,
    ) -> None:
        """Responsibilities: _method AST field traversal_."""
        if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef):
            return
        self._append_field_access(current, boundaries, accesses)
        for child in self._node_index.children(current):
            self._append_accesses(child, boundaries, accesses)

    def _method_field_accesses(self, definition: ast.AST) -> FieldAccessMap:
        """Responsibilities: _method field access state_."""
        accesses: FieldAccessMap = {"reads": set(), "writes": set()}
        if type(definition) is ast.FunctionDef:
            boundaries = self._first_receiver_boundary(definition.args, definition.body)
        else:
            if type(definition) is ast.AsyncFunctionDef:
                boundaries = self._first_receiver_boundary(definition.args, definition.body)
            else:
                boundaries = []
        for child in self._node_index.children(definition):
            self._append_accesses(child, boundaries, accesses)
        return accesses

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _AST node index dependency_."""
        self._node_index: PythonAstNodeIndexContract = node_index

    def field_name(self, attribute: ast.AST) -> str:
        """Responsibilities: _receiver field names_."""
        if type(attribute) is not ast.Attribute:
            return ""
        if type(attribute.value) is not ast.Name:
            return ""
        if attribute.value.id != "self":
            return ""
        return attribute.attr

    def field_access_effects(self, field_reference: ast.AST) -> frozenset[str]:
        """Responsibilities: _field access roles_."""
        parents = self._node_index.parents(field_reference)
        if len(parents) == 0:
            return PYTHON_FIELD_READ_EFFECTS
        parent = parents[0]
        if type(parent) is ast.Assign:
            return self._assignment_effects(field_reference, parent)
        if type(parent) is ast.AnnAssign:
            return self._annotation_assignment_effects(field_reference, parent)
        if type(parent) is ast.AugAssign and parent.target is field_reference:
            return PYTHON_FIELD_READ_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def method_record(
        self,
        method_definition: PythonCallableAstNode,
        method_name: str,
    ) -> PythonMethodRecordContract:
        """Responsibilities: _method access record_."""
        accesses = self._method_field_accesses(method_definition)
        return PythonMethodRecordValue(
            method_name,
            method_definition,
            accesses["writes"],
            accesses["reads"],
        )
