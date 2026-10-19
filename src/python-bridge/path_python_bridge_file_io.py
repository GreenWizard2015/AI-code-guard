from pathlib import Path

from protocols import PythonBridgeFileIOContract


class PathPythonBridgeFileIO(PythonBridgeFileIOContract):
    """Responsibilities: _filesystem source membership_, _filesystem source reading_."""

    def _absolute_path(self, path: Path) -> Path:
        """Responsibilities: _filesystem path normalization_."""
        return path.expanduser().resolve()

    def file_present(self, path: Path) -> bool:
        """Responsibilities: _filesystem source existence_."""
        return self._absolute_path(path).is_file()

    def source_content(self, path: Path) -> str:
        """Responsibilities: _filesystem source text_."""
        absolute_path = self._absolute_path(path)
        if not absolute_path.is_file():
            raise FileNotFoundError(absolute_path)
        return absolute_path.read_text(encoding="utf-8")
