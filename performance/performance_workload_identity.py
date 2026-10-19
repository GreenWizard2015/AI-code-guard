"""Comparable performance workload identity."""

from __future__ import annotations

from performance.protocols import PerformanceWorkloadIdentityContract


class PerformanceWorkloadIdentity:
    """Responsibilities: _performance workload identity state_, _identity comparison_."""

    def __init__(self, project_root: str, typescript_files: int, python_files: int) -> None:
        """Responsibilities: _performance workload identity initialization_."""
        self._project_root: str = project_root
        self._typescript_files: int = typescript_files
        self._python_files: int = python_files

    def project_root(self) -> str:
        """Responsibilities: _project root identity access_."""
        return self._project_root

    def typescript_files(self) -> int:
        """Responsibilities: _TypeScript file-count identity access_."""
        return self._typescript_files

    def python_files(self) -> int:
        """Responsibilities: _Python file-count identity access_."""
        return self._python_files

    def matches(self, other: PerformanceWorkloadIdentityContract) -> bool:
        """Responsibilities: _workload identity comparison_."""
        if self.project_root() != other.project_root():
            return False
        if self.typescript_files() != other.typescript_files():
            return False
        return self.python_files() == other.python_files()
