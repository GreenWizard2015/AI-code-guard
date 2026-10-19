from dataclasses import dataclass

from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportReferenceContract,
)


@dataclass(frozen=True)
class PythonDynamicImportCallTarget:
    """Responsibilities: _dynamic import target_."""

    reference: PythonDynamicImportReferenceContract
    name: str
