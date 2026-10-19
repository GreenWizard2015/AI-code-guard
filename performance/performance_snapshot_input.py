from pathlib import Path

from performance.protocols import PerformanceSnapshotInputContract


class PerformanceSnapshotInput(PerformanceSnapshotInputContract):
    """Responsibilities: _snapshot file path_, _snapshot text_."""

    _path: Path
    _content: str

    def __init__(self, path: Path, content: str) -> None:
        """Responsibilities: _snapshot input initialization_."""
        self._path: Path = path
        self._content: str = content

    def path(self) -> Path:
        """Responsibilities: _snapshot source path_."""
        return self._path

    def content(self) -> str:
        """Responsibilities: _snapshot markdown content_."""
        return self._content
