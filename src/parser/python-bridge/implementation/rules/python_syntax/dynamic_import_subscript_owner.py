from dataclasses import dataclass


@dataclass(frozen=True)
class PythonDynamicImportSubscriptOwner:
    """Responsibilities: _dynamic import subscript owner_."""

    module: str
    name: str
