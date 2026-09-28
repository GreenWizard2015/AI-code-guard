from __future__ import annotations

from typing import Protocol


class PythonDynamicImportReferenceProtocol(Protocol):
    """Responsibilities: _dynamic import reference contract_."""

    def kind_value(self) -> str: ...

    def name_value(self) -> str: ...

    def available(self) -> bool: ...
