from pathlib import Path
from typing import Protocol


class PythonBridgeFileIOContract(Protocol):
    """Responsibilities: _bridge file membership_, _source content retrieval_."""

    def file_present(self, path: Path) -> bool: ...

    def source_content(self, path: Path) -> str: ...
