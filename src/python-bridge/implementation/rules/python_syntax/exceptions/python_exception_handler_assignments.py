from __future__ import annotations

import ast

from implementation.rules.protocols import PythonExceptionHandlerAssignmentsContract


class PythonExceptionHandlerAssignments(PythonExceptionHandlerAssignmentsContract):
    """Responsibilities: _handler assignment tracking_, _exception cause resolution_."""

    _values: dict[str, ast.AST]

    def _target_names(self, target: ast.AST) -> list[str]:
        """Responsibilities: _assignment target names_."""
        match target:
            case ast.Name(id=name):
                return [name]
            case ast.Tuple(elts=items) | ast.List(elts=items):
                return [name for item in items for name in self._target_names(item)]
            case _:
                return []

    def __init__(self) -> None:
        """Responsibilities: _handler assignment initialization_."""
        self._values = {}

    def record_statement(self, statement: ast.stmt) -> None:
        """Responsibilities: _handler statement bindings_."""
        match statement:
            case ast.Assign(targets=targets, value=value):
                assignment_targets = targets
            case ast.AnnAssign(target=target, value=value):
                if value is None:
                    return
                assignment_targets = [target]
            case _:
                return
        for assignment_target in assignment_targets:
            for name in self._target_names(assignment_target):
                self._values.update({name: value})

    def explicit_none_cause(self, cause: ast.AST) -> bool:
        """Responsibilities: _explicit exception cause resolution_."""
        seen: set[str] = set()
        while True:
            match cause:
                case ast.Name(id=name) if name not in seen:
                    seen.add(name)
                    assigned = self._values.get(name)
                    if assigned is None:
                        return False
                    cause = assigned
                case ast.Constant(value=None):
                    return True
                case _:
                    return False
