from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonInstanceWriteLookupContract,
    PythonPositionedWriteContract,
    PythonPositionedWriteMap,
    PythonScopedOwnerMap,
)
from implementation.references.instances.python_instance_write import (
    PythonInstanceWrite,
)
from implementation.references.instances.python_instance_write_lookup import (
    PythonInstanceWriteLookup,
)


class PythonScopedOwnerState:
    """Responsibilities: _lexically scoped owner records_, _positioned owner lookup_."""

    _writes: PythonPositionedWriteMap
    _annotations: PythonPositionedWriteMap
    _owners: PythonScopedOwnerMap
    _include_module_name: bool

    def _positioned_lookup(
        self,
        writes: list[PythonPositionedWriteContract],
        node: ast.AST,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _positioned owner lookup_."""
        lookup = PythonInstanceWriteLookup(False, "")
        for write in writes:
            lookup = lookup.with_candidate(write, node)
        return lookup

    def _configured_owner(
        self,
        scope: str,
        name: str,
        key: str,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _unpositioned owner fallback_."""
        if key in self._writes or key in self._annotations:
            return PythonInstanceWriteLookup(True, "")
        if key in self._owners:
            return PythonInstanceWriteLookup(True, self._owners[key])
        if self._include_module_name and scope == "module" and name in self._owners:
            return PythonInstanceWriteLookup(True, self._owners[name])
        return PythonInstanceWriteLookup(False, "")

    def _owner_at_scope(
        self, scope: str, name: str, node: ast.AST
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _scope owner lookup_."""
        key = f"{scope}\u0000{name}"
        runtime_owner = self._positioned_lookup(self._writes.get(key, []), node)
        if runtime_owner.present():
            return runtime_owner
        annotation_owner = self._positioned_lookup(self._annotations.get(key, []), node)
        if annotation_owner.present():
            return annotation_owner
        return self._configured_owner(scope, name, key)

    def __init__(
        self,
        writes: PythonPositionedWriteMap,
        annotations: PythonPositionedWriteMap,
        owners: PythonScopedOwnerMap,
        include_module_name: bool,
    ) -> None:
        """Responsibilities: _scoped owner state initialization_."""
        self._writes: PythonPositionedWriteMap = writes
        self._annotations: PythonPositionedWriteMap = annotations
        self._owners: PythonScopedOwnerMap = owners
        self._include_module_name: bool = include_module_name

    def record_at_scope(self, scope: str, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _positioned owner recording_."""
        key = f"{scope}\u0000{name}"
        write = PythonInstanceWrite(node.lineno, node.col_offset, owner)
        self._writes.setdefault(key, []).append(write)
        self._owners[key] = owner

    def annotate_at_scope(
        self, scope: str, name: str, owner: str, node: ast.AST
    ) -> None:
        """Responsibilities: _positioned owner annotation_."""
        key = f"{scope}\u0000{name}"
        write = PythonInstanceWrite(node.lineno, node.col_offset, owner)
        self._annotations.setdefault(key, []).append(write)

    def owner_at_scopes(self, scopes: list[str], name: str, node: ast.AST) -> str:
        """Responsibilities: _lexical owner resolution_."""
        for scope in scopes:
            result = self._owner_at_scope(scope, name, node)
            if result.present():
                return result.owner_name()
        return ""

    def binding_present(self, scopes: list[str], name: str) -> bool:
        """Responsibilities: _lexical binding presence_."""
        for scope in scopes:
            key = f"{scope}\u0000{name}"
            if self._writes.get(key):
                return True
            if self._annotations.get(key):
                return True
            if key in self._owners:
                return True
            if scope == "module" and name in self._owners:
                return True
        return False
