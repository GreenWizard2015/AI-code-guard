from pathlib import Path


class InMemoryPerformanceSnapshotIO:
    """Responsibilities: _virtual snapshot lookup_, _snapshot text retrieval_."""

    def __init__(self, snapshots: dict[Path, str]) -> None:
        """Responsibilities: _snapshot collection initialization_."""
        self._snapshots: dict[Path, str] = snapshots

    def snapshot_paths(self, inputs: list[str]) -> list[Path]:
        """Responsibilities: _snapshot path selection_."""
        paths: list[Path] = []
        for input_path in inputs:
            path = Path(input_path)
            if path in self._snapshots:
                paths.append(path)
        return paths

    def snapshot_text(self, path: Path) -> str:
        """Responsibilities: _snapshot source text lookup_."""
        try:
            return self._snapshots[path]
        except KeyError as error:
            raise FileNotFoundError(path) from error
