from __future__ import annotations

from dataclasses import dataclass

from implementation.types import CallablePythonRuleStage


@dataclass(frozen=True)
class PythonRuleStageEntry:
    """Responsibilities: _Python rule dispatch_."""

    stage: CallablePythonRuleStage
    name: str


@dataclass(frozen=True)
class PythonTimeName:
    """Responsibilities: _time module identity_, _time callable identity_."""

    module: str
    callable_name: str


@dataclass
class PythonImportedNames:
    """Responsibilities: _symbol name index_."""

    names: set[str]
    modules: set[str]


@dataclass(frozen=True)
class PythonBatchSources:
    """Responsibilities: _batch identity_, _source text mapping_."""

    batch_id: str
    sources: dict[str, str]
