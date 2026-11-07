from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property

from implementation.references.protocols import (
    PythonSubtestAliasesOptionsContract,
)


@dataclass
class PythonSubtestAliasAnalysisState:
    """Responsibilities: _source assignment history_, _subtest alias transitions_."""

    assignments: list[ast.AST]
    receivers: dict[str, str]
    subtests: set[str]


class PythonSubtestAliasAnalysis:
    """Responsibilities: _single subtest scope analysis_, _receiver alias ownership_."""

    def _target_values(self, assignment: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _destructured alias resolution_."""
        if type(assignment) is ast.Assign:
            if len(assignment.targets) == 1:
                return self._options.assignment_aliases.target_values(
                    assignment.targets[0],
                    assignment.value,
                )
        if type(assignment) is ast.AnnAssign:
            if assignment.value is not None:
                return self._options.assignment_aliases.target_values(
                    assignment.target,
                    assignment.value,
                )
        return {}

    def _assignments_before(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _prior assignment selection_."""
        prior_assignments: list[ast.AST] = []
        for assignment in self._state.assignments:
            if assignment.lineno < node.lineno:
                prior_assignments.append(assignment)
                continue
            if assignment.lineno > node.lineno:
                continue
            if assignment.col_offset < node.col_offset:
                prior_assignments.append(assignment)
        return prior_assignments

    def _resolve(self, name: str, aliases: dict[str, str]) -> str:
        """Responsibilities: _alias chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases:
            if resolved in seen:
                break
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

    def _record_name(self, target: str, value: ast.Name) -> None:
        """Responsibilities: _named alias recording_."""
        if value.id in self._state.subtests:
            self._state.subtests.add(target)
            return
        if self._resolve(value.id, self._state.receivers) == "self":
            self._state.receivers.update({target: value.id})
            return
        self._state.receivers.pop(target, None)
        self._state.subtests.discard(target)

    def _record_target(self, target: str, value: ast.AST) -> None:
        """Responsibilities: _subtest alias target recording_."""
        if type(value) is ast.Name:
            self._record_name(target, value)
            return
        if self._bound_subtest(value, self._state.receivers):
            self._state.subtests.add(target)
            return
        self._state.receivers.pop(target, None)
        self._state.subtests.discard(target)

    def _receiver_names(self, context: ast.AST) -> dict[str, str]:
        """Responsibilities: _receiver alias collection_."""
        receivers = {"self": "self"}
        for assignment in self._assignments_before(context):
            for target, value in self._target_values(assignment).items():
                if type(value) is not ast.Name:
                    continue
                if self._resolve(value.id, receivers) == "self":
                    receivers[target] = value.id
        return receivers

    def _context_subtest(self, context: ast.AST, aliases: set[str]) -> bool:
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
        target: ast.AST,
        scope: ast.AST,
        assignments: list[ast.AST],
        options: PythonSubtestAliasesOptionsContract,
    ) -> None:
        """Responsibilities: _subtest scope state initialization_."""
        self._target: ast.AST = target
        self._scope: ast.AST = scope
        self._state: PythonSubtestAliasAnalysisState = PythonSubtestAliasAnalysisState(
            assignments,
            {"self": "self"},
            set(),
        )
        self._options: PythonSubtestAliasesOptionsContract = options

    @cached_property
    def aliases(self) -> set[str]:
        """Responsibilities: _subtest alias collection_."""
        for assignment in self._assignments_before(self._target):
            for target, value in self._target_values(assignment).items():
                self._record_target(target, value)
        return self._state.subtests

    def matches(self, aliases: set[str]) -> bool:
        """Responsibilities: _subtest context matching_."""
        if type(self._target) is ast.With or type(self._target) is ast.AsyncWith:
            items = self._target.items
        else:
            return False
        return any(self._context_subtest(item.context_expr, aliases) for item in items)
