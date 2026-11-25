from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.ast.callables.coding_issue_protocols import PythonRuleStageEntryContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonAstCallableDependenciesOptions:
    """Responsibilities: _callable dependency inputs_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    type_aliases: PythonScopedTypeAliasesContract


@dataclass(frozen=True)
class PythonRuleNodeDispatch:
    """Responsibilities: _AST node rule stages_, _precedence eligibility_."""

    stages: list[PythonRuleStageEntryContract]
    checks_precedence: bool
    checks_proxy: bool = False


@dataclass(frozen=True)
class PythonAstCodingIssueInputs:
    """Responsibilities: _coding issue source inputs_, _reference analysis dependencies_."""

    tree: ast.Module
    source: str
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    reference_aliases: PythonReferenceAliasesContract


@dataclass(frozen=True)
class PythonAstCodingIssueResult:
    """Responsibilities: _coding issue diagnostics_, _analysis timing results_."""

    issues: list[JsonObject]
    timings: dict[str, float]


@dataclass(frozen=True)
class PythonTypeAliasRecord:
    """Responsibilities: _scoped alias identity_, _source alias location_."""

    name: str
    target: str
    scope: ast.AST
    line: int


@dataclass(frozen=True)
class PythonClassNodeOptions:
    """Responsibilities: _class normalization inputs_."""

    node: ast.ClassDef
    source: str
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    type_aliases: PythonScopedTypeAliasesContract
    module_body: list[ast.stmt]
