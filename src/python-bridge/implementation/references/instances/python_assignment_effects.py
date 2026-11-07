from __future__ import annotations

import ast

from implementation.rules.protocols import PythonAssignmentEffectsContract


class PythonAssignmentEffects(PythonAssignmentEffectsContract):
    """Responsibilities: _assignment expression state_, _assignment target ownership_, _annotation state_."""

    def __init__(self, node: ast.AST) -> None:
        """Responsibilities: _assignment syntax ownership_."""
        self._node: ast.AST = node

    def assignment_targets(self) -> list[ast.AST]:
        """Responsibilities: _assignment target access_."""
        if type(self._node) is ast.Assign:
            return list(self._node.targets)
        if type(self._node) is ast.AnnAssign:
            return [self._node.target]
        if type(self._node) is ast.NamedExpr:
            return [self._node.target]
        return []

    def assigned_value(self) -> ast.AST:
        """Responsibilities: _assigned expression access_."""
        if type(self._node) is ast.Assign:
            return self._node.value
        if type(self._node) is ast.AnnAssign:
            if self._node.value is not None:
                return self._node.value
        if type(self._node) is ast.NamedExpr:
            if self._node.value is not None:
                return self._node.value
        return ast.Constant(value=None)

    def declared_annotation(self) -> ast.expr:
        """Responsibilities: _declared annotation access_."""
        if type(self._node) is ast.AnnAssign:
            return self._node.annotation
        return ast.Constant(value=None)

    def target_names(self) -> set[str]:
        """Responsibilities: _assignment binding names_."""
        names: set[str] = set()
        for target in self.assignment_targets():
            for node in ast.walk(target):
                if type(node) is ast.Name and type(node.ctx) is ast.Store:
                    names.add(node.id)
        return names

    def runtime_value_present(self) -> bool:
        """Responsibilities: _runtime assignment classification_."""
        if type(self._node) is ast.Assign or type(self._node) is ast.NamedExpr:
            return True
        if type(self._node) is ast.AnnAssign:
            return self._node.value is not None
        return False

    def annotation_present(self) -> bool:
        """Responsibilities: _annotation classification_."""
        return type(self._node) is ast.AnnAssign
