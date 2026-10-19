from __future__ import annotations

from dataclasses import dataclass, field

from implementation.references.protocols import (
    PythonReferenceBuilderContract,
    PythonReferenceContextContract,
)
from implementation.types import JsonObject


@dataclass
class PythonReferenceState:
    """Responsibilities: _reference context storage_, _storage reference builders records_."""

    context: PythonReferenceContextContract = field(init=False)
    builder: PythonReferenceBuilderContract = field(init=False)
    references: list[JsonObject] = field(default_factory=list)
