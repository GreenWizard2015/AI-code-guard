from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import TypeAlias

from implementation.types import JsonObject

from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.ast.protocols import (
    PythonSubtestAliasesContract,
    PythonTestOrderDependencyContract,
)
from implementation.rules.protocols import (
    PythonCodingIssueStagesContract,
    PythonFieldMutationCollectorContract,
)
from implementation.rules.protocols import (
    PythonControlFlowIssuesContract,
    PythonOperatorPrecedenceContract,
)
from implementation.rules.protocols import (
    PythonSingleItemArrayStateRulesContract,
    PythonUnboundedTypeRulesContract,
    PythonUnionRulesContract,
    PythonUnnecessaryUndefinedCheckContract,
)

PythonTestMutationIndex = dict[ast.AST, set[ast.AST]]
PythonScopeTypes = set[type[ast.AST]]
PythonAliasTimeline: TypeAlias = list[JsonObject]
PythonScopeAliasHistoryData: TypeAlias = dict[str, PythonAliasTimeline]
PythonScopeAliasHistories: TypeAlias = dict[ast.AST, PythonScopeAliasHistoryData]


@dataclass(frozen=True)
class AliasWalkStateDataContract:
    """Responsibilities: _alias traversal state_, _resolution path history_."""

    current: str
    aliases: dict[str, str]
    bindings: dict[str, ast.expr]
    resolution_map: dict[str, ast.expr]
    path: list[str]
    positions: dict[str, int]
    result: ast.expr
    result_present: bool


@dataclass(frozen=True)
class PythonCodingIssueTypeBundleContract:
    """Responsibilities: _union type rules_, _unbounded type rules_."""

    union_rules: PythonUnionRulesContract
    unbounded_type_rules: PythonUnboundedTypeRulesContract


@dataclass(frozen=True)
class PythonCodingIssueBoundaryBundleContract:
    """Responsibilities: _field mutation collection_, _type boundary checks_."""

    field_mutations: PythonFieldMutationCollectorContract
    proxy_analyzer: PythonProxyCallableAnalyzerContract
    unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract


@dataclass(frozen=True)
class PythonCodingIssueStructureBundleContract:
    """Responsibilities: _control flow analysis_, _expression structure rules_."""

    subtest_aliases: PythonSubtestAliasesContract
    control_flow: PythonControlFlowIssuesContract
    python_operator_precedence: PythonOperatorPrecedenceContract
    simple_stages: PythonCodingIssueStagesContract
    source_nodes: list[ast.AST]
    test_order_dependency: PythonTestOrderDependencyContract


@dataclass(frozen=True)
class PythonCodingIssueAssemblyBundleContract:
    """Responsibilities: _type boundary assembly_, _syntax structure assembly_."""

    type_state: PythonCodingIssueTypeBundleContract
    boundary_state: PythonCodingIssueBoundaryBundleContract
    structure_state: PythonCodingIssueStructureBundleContract
    array_state_rules: PythonSingleItemArrayStateRulesContract
