from __future__ import annotations

from pathlib import Path
from protocols import PythonBridgeFileIOContract


class PythonBridgeInput:
    """Responsibilities: _bridge source paths resolution_, _source text access_."""

    _code_prefix: str = "code:"
    _file_prefix: str = "File:"

    def _file_path(self, source: str) -> Path:
        """Responsibilities: _resolution file-prefixed source path_."""
        path_text = source[len(self._file_prefix) :].strip()
        if not path_text:
            raise ValueError("File source must contain a path")
        return Path(path_text)

    def _read_file(self, path: Path) -> str:
        """Responsibilities: _source file access_."""
        if not self.file_io.file_present(path):
            raise FileNotFoundError(path)
        return self.file_io.source_content(path)

    def __init__(self, file_io: PythonBridgeFileIOContract) -> None:
        """Responsibilities: _bridge file IO ownership_."""
        self.file_io: PythonBridgeFileIOContract = file_io

    def file_text(self, source: str) -> str:
        """Responsibilities: _resolution file code source_."""
        return self._read_file(self._file_path(source))

    def resolve(self, source: str) -> str:
        """Responsibilities: _resolution bridge input source_."""
        if source.startswith(self._code_prefix):
            return source[len(self._code_prefix) :]
        if source.startswith(self._file_prefix):
            return self.file_text(source)
        return source
