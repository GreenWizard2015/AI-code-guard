from __future__ import annotations

import ast
from functools import cached_property

from implementation.references.protocols import (
    PythonSubtestAliasesOptionsContract,
)
from implementation.references.test_assertions.types import (
    PythonSubtestAliasAnalysisState,
    PythonSubtestAliasMap,
    PythonSubtestAssignmentList,
    PythonSubtestTargetValues,
)
from implementation.types import PythonASTLocatedNode


class PythonSubtestAliasAnalysis:
    """Responsibilities: _single subtest scope analysis_, _receiver alias ownership_."""

    def _target_values(self, alias_assignment: PythonASTLocatedNode) -> PythonSubtestTargetValues:
        """Responsibilities: _destructured alias resolution_."""
        cached = self._state.assignment_aliases.get(alias_assignment)
        if cached is not None:
            return cached
        values = self._compute_target_values(alias_assignment)
        self._state.assignment_aliases.update({alias_assignment: values})
        return values

    def _compute_target_values(self, source_assignment: PythonASTLocatedNode) -> PythonSubtestTargetValues:
        """Responsibilities: _assignment target aliases_."""
        if type(source_assignment) is ast.Assign:
            if len(source_assignment.targets) == 1:
                return self._options.assignment_aliases.target_values(
                    source_assignment.targets[0],
                    source_assignment.value,
                )
        if type(source_assignment) is ast.AnnAssign:
            if source_assignment.value is not None:
                return self._options.assignment_aliases.target_values(
                    source_assignment.target,
                    source_assignment.value,
                )
        return {}

    def _assignment_precedes(self, earlier_assignment: PythonASTLocatedNode, node: PythonASTLocatedNode) -> bool:
        """Responsibilities: _single assignment source-order comparison_."""
        if type(earlier_assignment) is ast.Assign:
            return (earlier_assignment.lineno, earlier_assignment.col_offset) < (node.lineno, node.col_offset)
        if type(earlier_assignment) is ast.AnnAssign:
            return (earlier_assignment.lineno, earlier_assignment.col_offset) < (node.lineno, node.col_offset)
        return False

    def _resolve(self, name: str, aliases: PythonSubtestAliasMap) -> str:
        """Responsibilities: _alias chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases and resolved not in seen:
            seen.add(resolved)
            resolved = aliases[resolved]
        return resolved

    def _bound_getattr_subtest(self, call: ast.Call, receivers: dict[str, str]) -> bool:
        """Responsibilities: _getattr subtest classification_."""
        if type(call.func) is not ast.Name:
            return False
        if call.func.id != "getattr":
            return False
        if len(call.args) < 2:
            return False
        target = call.args[0]
        if type(target) is not ast.Name:
            return False
        if self._resolve(target.id, receivers) != "self":
            return False
        return self._options.container_keys.static_key(call.args[1]) == "subTest"

    def _bound_subtest(self, value: ast.AST, receivers: dict[str, str]) -> bool:
        """Responsibilities: _bound subtest classification_."""
        if type(value) is ast.Attribute:
            if value.attr != "subTest":
                return False
            if type(value.value) is not ast.Name:
                return False
            return self._resolve(value.value.id, receivers) == "self"
        if type(value) is ast.Call:
            return self._bound_getattr_subtest(value, receivers)
        return False

    def _record_target(self, target: str, value: ast.AST) -> None:
        """Responsibilities: _subtest alias transitions_."""
        if type(value) is ast.Name:
            if value.id in self._state.subtests:
                self._state.subtests.add(target)
                return
            if self._resolve(value.id, self._state.receivers) == "self":
                self._state.receivers.update({target: value.id})
                return
        else:
            if self._bound_subtest(value, self._state.receivers):
                self._state.subtests.add(target)
                return
        self._state.receivers.pop(target, None)
        self._state.subtests.discard(target)

    def _receiver_names(self, context: PythonASTLocatedNode) -> dict[str, str]:
        """Responsibilities: _receiver alias collection_."""
        receivers = {"self": "self"}
        for assignment in self._state.assignments:
            if not self._assignment_precedes(assignment, context):
                continue
            for target, value in self._target_values(assignment).items():
                if type(value) is not ast.Name:
                    continue
                if self._resolve(value.id, receivers) == "self":
                    receivers[target] = value.id
        return receivers

    def _context_subtest(self, context: PythonASTLocatedNode, aliases: set[str]) -> bool:
        """Responsibilities: _context subtest classification_."""
        if type(context) is ast.Call:
            context = context.func
        if type(context) is ast.Name:
            if context.id in aliases:
                return True
        receivers = self._receiver_names(context)
        return self._bound_subtest(context, receivers)

    def __init__(
        self,
        target: PythonASTLocatedNode,
        scope: ast.AST,
        assignments: PythonSubtestAssignmentList,
        options: PythonSubtestAliasesOptionsContract,
    ) -> None:
        """Responsibilities: _subtest scope state initialization_."""
        self._target: PythonASTLocatedNode = target
        self._scope: ast.AST = scope
        self._state: PythonSubtestAliasAnalysisState = PythonSubtestAliasAnalysisState(
            assignments,
            {"self": "self"},
            set(),
            {},
        )
        self._options: PythonSubtestAliasesOptionsContract = options

    @cached_property
    def aliases(self) -> set[str]:
        """Responsibilities: _subtest alias collection_."""
        for assignment in self._state.assignments:
            if not self._assignment_precedes(assignment, self._target):
                continue
            for target, value in self._target_values(assignment).items():
                self._record_target(target, value)
        return self._state.subtests

    def matches(self, aliases: set[str]) -> bool:
        """Responsibilities: _subtest context matching_."""
        match self._target:
            case ast.With(items=items) | ast.AsyncWith(items=items):
                return any(self._context_subtest(item.context_expr, aliases) for item in items)
            case _:
                return False
