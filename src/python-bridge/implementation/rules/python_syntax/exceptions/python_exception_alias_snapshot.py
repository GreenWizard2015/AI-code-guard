from __future__ import annotations

from implementation.protocols import (
    PythonExceptionAliasSnapshotContract,
    PythonExceptionBroadnessContract,
)


class PythonExceptionAliasSnapshot(PythonExceptionAliasSnapshotContract):
    """Responsibilities: _exception alias snapshots_, _lexical state restoration_."""

    def __init__(
        self,
        exception_names: frozenset[str],
        module_names: frozenset[str],
        multi_exception_names: frozenset[str],
    ) -> None:
        """Responsibilities: _exception alias snapshot initialization_."""
        self._exception_names: frozenset[str] = exception_names
        self._module_names: frozenset[str] = module_names
        self._multi_exception_names: frozenset[str] = multi_exception_names

    def exception_names(self) -> frozenset[str]:
        """Responsibilities: _exception alias access_."""
        return self._exception_names

    def module_names(self) -> frozenset[str]:
        """Responsibilities: _module alias access_."""
        return self._module_names

    def restore(
        self,
        broadness: PythonExceptionBroadnessContract,
        multi_exception_names: set[str],
    ) -> None:
        """Responsibilities: _exception alias state restoration_."""
        broadness.restore_snapshot(self)
        multi_exception_names.clear()
        multi_exception_names.update(self._multi_exception_names)
