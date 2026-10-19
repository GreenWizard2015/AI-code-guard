from __future__ import annotations

from typing import TypeAlias

from implementation.references.instances.python_instance_write import (
    PythonInstanceWrite,
)


PythonInstanceWriteRecords: TypeAlias = dict[str, list[PythonInstanceWrite]]
