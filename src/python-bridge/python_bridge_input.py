from __future__ import annotations

from pathlib import Path

from protocols import PythonBridgeFileIOContract


class PythonBridgeInput:
    """Responsibilities: _bridge source paths resolution_, _source text access_."""

    _code_prefix: str = "code:"
    _file_prefix: str = "File:"

    def _file_path(self, file_reference: str) -> Path:
        """Responsibilities: _resolution file-prefixed source path_."""
        path_text = file_reference[len(self._file_prefix) :].strip()
        if not path_text:
            raise ValueError("File source must contain a path")
        return Path(path_text)

    def __init__(self, file_io: PythonBridgeFileIOContract) -> None:
        """Responsibilities: _bridge file IO ownership_."""
        self._file_io: PythonBridgeFileIOContract = file_io

    def file_text(self, file_path: Path) -> str:
        """Responsibilities: _source file access_."""
        if not self._file_io.file_present(file_path):
            raise FileNotFoundError(file_path)
        return self._file_io.source_content(file_path)

    def resolve(self, source: str) -> str:
        """Responsibilities: _resolution bridge input source_."""
        if source.startswith(self._code_prefix):
            return source[len(self._code_prefix) :]
        if source.startswith(self._file_prefix):
            path = self._file_path(source)
            return self.file_text(path)
        return source
