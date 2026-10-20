from __future__ import annotations

import ast
from implementation.rules.protocols import PythonAssignmentEffectsContract


class PythonAssignmentEffects(PythonAssignmentEffectsContract):
    """Responsibilities: _assignment targets_, _runtime and annotation effects_."""

    value: ast.AST
    annotation: ast.AST
    _targets: list[ast.AST]
    _runtime_value_present: bool
    _annotation_present: bool

    def __init__(self, node: ast.AST) -> None:
        """Responsibilities: _assignment effect decoding_."""
        self._value: ast.AST = ast.Constant(value=None)
        self._annotation: ast.AST = ast.Constant(value=None)
        self._targets: list[ast.AST] = []
        self._runtime_value_present: bool = False
        self._annotation_present: bool = False
        if type(node) is ast.Assign:
            self._value: ast.AST = node.value
            self._targets: list[ast.AST] = node.targets
            self._runtime_value_present: bool = True
        else:
            if type(node) is ast.AnnAssign:
                if node.value is not None:
                    self._value: ast.AST = node.value
                    self._runtime_value_present: bool = True
                self._annotation: ast.AST = node.annotation
                self._annotation_present: bool = True
                self._targets: list[ast.AST] = [node.target]
            else:
                if type(node) is ast.NamedExpr:
                    self._value: ast.AST = node.value
                    self._runtime_value_present: bool = True
                    self._targets: list[ast.AST] = [node.target]

    def assignment_targets(self) -> list[ast.AST]:
        """Responsibilities: _assignment target access_."""
        return list(self._targets)

    def assigned_value(self) -> ast.AST:
        """Responsibilities: _assigned expression access_."""
        return self._value

    def declared_annotation(self) -> ast.AST:
        """Responsibilities: _declared annotation access_."""
        return self._annotation

    def target_names(self) -> set[str]:
        """Responsibilities: _assignment binding names_."""
        names: set[str] = set()
        for target in self._targets:
            for node in ast.walk(target):
                if type(node) is ast.Name and type(node.ctx) is ast.Store:
                    names.add(node.id)
        return names

    def runtime_value_present(self) -> bool:
        """Responsibilities: _runtime assignment classification_."""
        return self._runtime_value_present

    def annotation_present(self) -> bool:
        """Responsibilities: _annotation classification_."""
        return self._annotation_present
