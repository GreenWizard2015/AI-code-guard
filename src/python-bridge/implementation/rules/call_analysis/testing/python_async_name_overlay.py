import ast

from implementation.ast.protocols import PythonAsyncNameOverlayContract
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)


class PythonAsyncNameOverlay(PythonAsyncNameOverlayContract):
    """Responsibilities: _async-name shadowing_, _test-local async aliases_."""

    def __init__(self, base: set[str], excluded: set[str]) -> None:
        """Responsibilities: _async-name overlay state_."""
        self._base: set[str] = base
        self._added: set[str] = set()
        self._removed: set[str] = set(excluded)

    def update_test_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _test-local async alias transitions_."""
        if type(node) is ast.AsyncFunctionDef:
            self._add(node.name)
            return
        if type(node) is ast.FunctionDef:
            self._discard(node.name)
            return
        effects = PythonAssignmentEffects(node)
        if not effects.runtime_value_present():
            return
        value = effects.assigned_value()
        alias = False
        if type(value) is ast.Name:
            alias = self._contains(value.id)
        for name in effects.target_names():
            self._discard(name)
            if alias:
                self._add(name)

    def async_call_name(self, statement: ast.Expr) -> str:
        """Responsibilities: _visible async invocation identity_."""
        if type(statement.value) is not ast.Call:
            return ""
        if type(statement.value.func) is not ast.Name:
            return ""
        name = statement.value.func.id
        if not self._contains(name):
            return ""
        return name

    def _contains(self, name: str) -> bool:
        """Responsibilities: _visible async-name lookup_."""
        if name in self._added:
            return True
        return name in self._base and name not in self._removed

    def _add(self, name: str) -> None:
        """Responsibilities: _test-local async alias addition_."""
        self._removed.discard(name)
        self._added.add(name)

    def _discard(self, name: str) -> None:
        """Responsibilities: _test-local async alias removal_."""
        self._added.discard(name)
        if name in self._base:
            self._removed.add(name)
