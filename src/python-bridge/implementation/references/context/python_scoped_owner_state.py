from __future__ import annotations

import ast
from typing import cast

from implementation.references.instances.python_instance_write import (
    PythonInstanceWrite,
)
from implementation.references.instances.python_instance_write_lookup import (
    PythonInstanceWriteLookup,
)
from implementation.references.protocols import (
    PythonInstanceWriteLookupContract,
    PythonPositionedWriteContract,
    PythonPositionedWriteMap,
    PythonScopedOwnerMap,
)
from implementation.types import PythonASTLocatedNode


class PythonScopedOwnerState:
    """Responsibilities: _lexically scoped owner records_, _positioned owner lookup_."""

    _writes: PythonPositionedWriteMap
    _annotations: PythonPositionedWriteMap
    _owners: PythonScopedOwnerMap
    _include_module_name: bool

    def _positioned_lookup(
        self,
        writes: list[PythonPositionedWriteContract],
        lookup_position: ast.AST,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _positioned owner lookup_."""
        lookup: PythonInstanceWriteLookupContract = PythonInstanceWriteLookup(is_present=False, owner_name="")
        for write in writes:
            lookup = lookup.with_candidate(write, lookup_position)
        return lookup

    def _configured_owner(
        self,
        scope_name: str,
        owner_name: str,
        key: str,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _unpositioned owner fallback_."""
        if key in self._writes or key in self._annotations:
            return PythonInstanceWriteLookup(is_present=True, owner_name="")
        if key in self._owners:
            return PythonInstanceWriteLookup(is_present=True, owner_name=self._owners[key])
        if self._include_module_name and scope_name == "module" and owner_name in self._owners:
            return PythonInstanceWriteLookup(is_present=True, owner_name=self._owners[owner_name])
        return PythonInstanceWriteLookup(is_present=False, owner_name="")

    def _owner_at_scope(
        self,
        scope_name: str,
        owner_name: str,
        owner_reference: ast.AST,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _scope owner lookup_."""
        key = f"{scope_name}\u0000{owner_name}"
        runtime_owner = self._positioned_lookup(
            self._writes.get(key, []),
            owner_reference,
        )
        if runtime_owner.present():
            return runtime_owner
        annotation_owner = self._positioned_lookup(
            self._annotations.get(key, []),
            owner_reference,
        )
        if annotation_owner.present():
            return annotation_owner
        return self._configured_owner(scope_name, owner_name, key)

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

    def record_at_scope(
        self,
        recording_scope: str,
        binding_name: str,
        owner: str,
        binding_site: ast.AST,
    ) -> None:
        """Responsibilities: _scoped binding indexing_."""
        key = f"{recording_scope}\u0000{binding_name}"
        write = PythonInstanceWrite(
            cast(PythonASTLocatedNode, binding_site).lineno,
            cast(PythonASTLocatedNode, binding_site).col_offset,
            owner,
        )
        if type(binding_site) is ast.AnnAssign:
            self._annotations.setdefault(key, []).append(write)
            return
        self._writes.setdefault(key, []).append(write)
        self._owners.update({key: owner})

    def owner_resolution(
        self,
        scopes: list[str],
        requested_name: str,
        owner_reference: ast.AST,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _lexical binding resolution_."""
        for scope in scopes:
            result = self._owner_at_scope(scope, requested_name, owner_reference)
            if result.present():
                return result
        return PythonInstanceWriteLookup(is_present=False, owner_name="")
