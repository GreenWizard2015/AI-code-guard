from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonCallAssignment:
    """Responsibilities: _direct assignment targets_, _call type annotations_."""

    _call: ast.Call
    _node_index: PythonAstNodeIndexContract

    def _assignment_targets(self) -> list[ast.expr]:
        """Responsibilities: _direct call assignment targets_."""
        parents = self._node_index.parents(self._call)
        if not parents:
            return []
        parent = parents[0]
        if type(parent) is ast.AnnAssign and parent.value is self._call:
            return [parent.target]
        if type(parent) is ast.Assign and parent.value is self._call and len(parent.targets) == 1:
            return parent.targets
        return []

    def __init__(self, call: ast.Call, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _call assignment lookup initialization_."""
        self._call: ast.Call = call
        self._node_index: PythonAstNodeIndexContract = node_index

    def target_name(self) -> str:
        """Responsibilities: _call target name_."""
        targets = self._assignment_targets()
        if len(targets) != 1:
            return ""
        target = targets[0]
        if type(target) is ast.Name:
            return target.id
        return ""

    def annotation_name(self) -> str:
        """Responsibilities: _call annotation name_."""
        parents = self._node_index.parents(self._call)
        if not parents or type(parents[0]) is not ast.AnnAssign:
            return ""
        parent = parents[0]
        if parent.value is not self._call:
            return ""
        annotation = parent.annotation
        if type(annotation) is ast.Name:
            return annotation.id
        if type(annotation) is ast.Attribute:
            return annotation.attr
        return ""
