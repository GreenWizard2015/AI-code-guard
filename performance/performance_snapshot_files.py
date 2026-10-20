"""Performance snapshot file source."""

from __future__ import annotations

import re
from pathlib import Path

from performance.constants import (
    COLD_MODE,
    PROJECT_ROOT_KEY,
    PROJECT_ROOT_LABEL,
    PYTHON_FILES_KEY,
    PYTHON_LABEL,
    STAGE_KEY_PREFIX,
    TYPESCRIPT_FILES_KEY,
    TYPESCRIPT_LABEL,
    WARM_MODE,
)
from performance.performance_snapshot import PerformanceSnapshot
from performance.performance_snapshots import PerformanceSnapshots
from performance.protocols import (
    PerformanceSnapshotContract,
    PerformanceSnapshotsContract,
    PerformanceSnapshotIOContract,
)


class PerformanceSnapshotFiles:
    """Responsibilities: _performance snapshot file source_, _snapshot collection creation_."""

    def _snapshot(self, path: Path) -> PerformanceSnapshotContract:
        """Responsibilities: _single snapshot parsing_."""
        values: dict[str, str] = {}
        for line in self.file_io.snapshot_text(path).splitlines():
            self._append_file_value(values, line)
            self._append_stage_value(values, line)
        name_parts = path.name.split("_", 1)
        mode = name_parts[0]
        if mode != COLD_MODE:
            mode = WARM_MODE
        return PerformanceSnapshot(values, mode, str(path))

    def _append_file_value(self, values: dict[str, str], line: str) -> None:
        """Responsibilities: _snapshot file-count parsing_."""
        match = re.match(rf"^- ({TYPESCRIPT_LABEL}|{PYTHON_LABEL}) files: (\d+)$", line)
        if match:
            if match.group(1) == PYTHON_LABEL:
                values[PYTHON_FILES_KEY] = match.group(2)
            else:
                values[TYPESCRIPT_FILES_KEY] = match.group(2)
        root_match = re.match(rf"^- {PROJECT_ROOT_LABEL}: `(.+)`$", line)
        if root_match:
            values[PROJECT_ROOT_KEY] = root_match.group(1)

    def _append_stage_value(self, values: dict[str, str], line: str) -> None:
        """Responsibilities: _snapshot stage parsing_."""
        match = re.match(r"^\| (.+) \| ([0-9]+(?:\.[0-9]+)?) sec \|$", line)
        if match:
            values[f"{STAGE_KEY_PREFIX}{match.group(1)}"] = match.group(2)

    def __init__(self, paths: list[Path], file_io: PerformanceSnapshotIOContract) -> None:
        """Responsibilities: _performance snapshot file-source initialization_."""
        self.paths: list[Path] = paths
        self.file_io: PerformanceSnapshotIOContract = file_io

    def snapshot_collection(self) -> PerformanceSnapshotsContract:
        """Responsibilities: _snapshot collection creation_."""
        snapshots = [self._snapshot(path) for path in self.paths]
        return PerformanceSnapshots(snapshots)

    def collection(self) -> PerformanceSnapshotsContract:
        """Responsibilities: _snapshot collection result_."""
        return self.snapshot_collection().validated()

    def source_available(self) -> bool:
        """Responsibilities: _performance snapshot source availability_."""
        return len(self.paths) > 0
