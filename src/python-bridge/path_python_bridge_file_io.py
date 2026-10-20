from pathlib import Path
from protocols import PythonBridgeFileIOContract


class PathPythonBridgeFileIO(PythonBridgeFileIOContract):
    """Responsibilities: _project-relative path resolution_, _filesystem source access_."""

    def __init__(self, working_directory: Path) -> None:
        """Responsibilities: _filesystem root ownership_."""
        self.working_directory: Path = working_directory.expanduser()

    def absolute_path(self, path: Path) -> Path:
        """Responsibilities: _stable source path resolution_."""
        expanded_path = path.expanduser()
        if expanded_path.is_absolute():
            return expanded_path.resolve()
        return (self.working_directory / expanded_path).resolve()

    def file_present(self, path: Path) -> bool:
        """Responsibilities: _filesystem source existence_."""
        absolute_path = self.absolute_path(path)
        return absolute_path.is_file()

    def source_content(self, path: Path) -> str:
        """Responsibilities: _filesystem source text_."""
        absolute_path = self.absolute_path(path)
        if not absolute_path.is_file():
            raise FileNotFoundError(absolute_path)
        return absolute_path.read_text(encoding="utf-8")
