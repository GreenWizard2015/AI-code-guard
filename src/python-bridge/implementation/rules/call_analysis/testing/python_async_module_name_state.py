from __future__ import annotations

import ast

from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)


class PythonAsyncModuleNameState:
    """Responsibilities: _module async binding lifecycle_, _import shadowing_."""

    _names: set[str]

    def _module_import_name(self, imported: ast.alias) -> str:
        """Responsibilities: _import binding identity_."""
        if imported.asname is not None:
            return imported.asname
        separator = imported.name.find(".")
        if separator < 0:
            return imported.name
        return imported.name[:separator]

    def _assignment(self, statement: ast.stmt) -> bool:
        """Responsibilities: _module assignment alias transition_."""
        if type(statement) not in (ast.Assign, ast.AnnAssign, ast.NamedExpr):
            return False
        effects = PythonAssignmentEffects(statement)
        if not effects.runtime_value_present():
            return True
        value = effects.assigned_value()
        alias = False
        if type(value) is ast.Name:
            alias = value.id in self._names
        for name in effects.target_names():
            self._names.discard(name)
            if alias:
                self._names.add(name)
        return True

    def _apply_statement(self, statement: ast.stmt) -> None:
        """Responsibilities: _module async name transitions_."""
        if self._assignment(statement):
            return
        match statement:
            case ast.AsyncFunctionDef(name=name):
                self._names.add(name)
            case ast.FunctionDef(name=name) | ast.ClassDef(name=name):
                self._names.discard(name)
            case ast.Import(names=imports) | ast.ImportFrom(names=imports):
                for imported in imports:
                    self._names.discard(self._module_import_name(imported))

    def __init__(self) -> None:
        """Responsibilities: _module async name initialization_."""
        self._names = set()

    def prepare(self, tree: ast.Module) -> None:
        """Responsibilities: _module async name indexing_."""
        self._names.clear()
        for statement in tree.body:
            self._apply_statement(statement)

    def snapshot(self) -> set[str]:
        """Responsibilities: _module async name snapshot_."""
        return set(self._names)
