from dataclasses import dataclass

from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportReferenceProtocol,
)


@dataclass(frozen=True)
class PythonDynamicImportCallTarget:
    """Responsibilities: _dynamic import target_."""

    reference: PythonDynamicImportReferenceProtocol
    name: str
