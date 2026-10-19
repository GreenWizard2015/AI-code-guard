from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.references.protocols import (
    PythonInstanceWriteLookupContract,
    PythonPositionedWriteContract,
)
from implementation.references.instances.types import PythonInstanceWriteRecords
from implementation.references.instances.python_instance_write import (
    PythonInstanceWrite,
)
from implementation.references.instances.python_instance_write_lookup import (
    PythonInstanceWriteLookup,
)


@dataclass(frozen=True)
class PythonScopedOwnerRecords:
    """Responsibilities: _owner event collections_, _owner lookup configuration_."""

    writes: PythonInstanceWriteRecords
    annotations: PythonInstanceWriteRecords
    owners: dict[str, str]
    include_module_name: bool


class PythonScopedOwnerState:
    """Responsibilities: _lexically scoped owner records_, _positioned owner lookup_."""

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
        if key in self.records.writes or key in self.records.annotations:
            return PythonInstanceWriteLookup(True, "")
        if key in self.records.owners:
            return PythonInstanceWriteLookup(True, self.records.owners[key])
        if (
            self.records.include_module_name
            and scope == "module"
            and name in self.records.owners
        ):
            return PythonInstanceWriteLookup(True, self.records.owners[name])
        return PythonInstanceWriteLookup(False, "")

    def _owner_at_scope(
        self, scope: str, name: str, node: ast.AST
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _scope owner lookup_."""
        key = f"{scope}\u0000{name}"
        runtime_owner = self._positioned_lookup(self.records.writes.get(key, []), node)
        if runtime_owner.present():
            return runtime_owner
        annotation_owner = self._positioned_lookup(
            self.records.annotations.get(key, []), node
        )
        if annotation_owner.present():
            return annotation_owner
        return self._configured_owner(scope, name, key)

    def __init__(self, records: PythonScopedOwnerRecords) -> None:
        """Responsibilities: _scoped owner dependencies_."""
        self.records: PythonScopedOwnerRecords = records

    def record_at_scope(self, scope: str, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _positioned owner recording_."""
        key = f"{scope}\u0000{name}"
        self.records.writes.setdefault(key, []).append(
            PythonInstanceWrite(node.lineno, node.col_offset, owner)
        )
        self.records.owners[key] = owner

    def annotate_at_scope(
        self, scope: str, name: str, owner: str, node: ast.AST
    ) -> None:
        """Responsibilities: _positioned owner annotation_."""
        key = f"{scope}\u0000{name}"
        self.records.annotations.setdefault(key, []).append(
            PythonInstanceWrite(node.lineno, node.col_offset, owner)
        )

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
            if self.records.writes.get(key):
                return True
            if self.records.annotations.get(key):
                return True
            if key in self.records.owners:
                return True
            if scope == "module" and name in self.records.owners:
                return True
        return False
