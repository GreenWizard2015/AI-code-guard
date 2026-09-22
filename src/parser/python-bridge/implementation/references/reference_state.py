from __future__ import annotations


from dataclasses import dataclass, field
from implementation.references.reference_context import PythonReferenceContext
from implementation.references.reference_builder import PythonReference
from implementation.types import JsonObject


@dataclass
class PythonReferenceState:
    """Responsibilities: _reference context storage_, _storage reference builders records_."""

    context: PythonReferenceContext = field(init=False)
    builder: PythonReference = field(init=False)
    references: list[JsonObject] = field(default_factory=list)
