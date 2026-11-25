from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from implementation.ast.protocols import (
        PythonAstNodeIndexContract,
        PythonSubtestAliasesContract,
        PythonTestOrderDependencyContract,
    )
    from implementation.protocols import PythonProxyCallableAnalyzerContract
    from implementation.references.protocols import (
        PythonReferenceAliasesContract,
    )
    from implementation.rules.protocols import (
        PythonCodingIssueBoundaryBundleContract,
        PythonCodingIssueStagesContract,
        PythonCodingIssueStructureBundleContract,
        PythonCodingIssueTypeBundleContract,
        PythonControlFlowIssuesContract,
        PythonFieldMutationCollectorContract,
        PythonOperatorPrecedenceContract,
        PythonSingleItemArrayStateRulesContract,
        PythonUnboundedTypeRulesContract,
        PythonUnionRulesContract,
        PythonUnnecessaryUndefinedCheckContract,
    )
    from implementation.rules.type_rule_protocols import (
        PythonArrayTypeInspectorContract,
        PythonReturnArrayAnalyzerContract,
    )
    from implementation.types import (
        CallablePythonRuleStage,
        InheritanceEdges,
        PythonAstCallableDeclarations,
        PythonClassFieldMap,
    )


@dataclass(frozen=True)
class AliasWalkStateData:
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
class PythonCodingIssueTypeBundle:
    """Responsibilities: _union type rules_, _unbounded type rules_."""

    union_rules: PythonUnionRulesContract
    unbounded_type_rules: PythonUnboundedTypeRulesContract


@dataclass(frozen=True)
class PythonCodingIssueStructureBundle:
    """Responsibilities: _control flow analysis_, _expression structure rules_."""

    subtest_aliases: PythonSubtestAliasesContract
    control_flow: PythonControlFlowIssuesContract
    python_operator_precedence: PythonOperatorPrecedenceContract
    simple_stages: PythonCodingIssueStagesContract
    source_nodes: list[ast.AST]
    test_order_dependency: PythonTestOrderDependencyContract


@dataclass(frozen=True)
class PythonCodingIssueBoundaryBundle:
    """Responsibilities: _field mutation collection_, _type boundary checks_."""

    field_mutations: PythonFieldMutationCollectorContract
    proxy_analyzer: PythonProxyCallableAnalyzerContract
    unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract


@dataclass(frozen=True)
class PythonCodingIssueAssemblyBundle:
    """Responsibilities: _type boundary assembly_, _syntax structure assembly_."""

    type_state: PythonCodingIssueTypeBundleContract
    boundary_state: PythonCodingIssueBoundaryBundleContract
    structure_state: PythonCodingIssueStructureBundleContract
    array_state_rules: PythonSingleItemArrayStateRulesContract


@dataclass(frozen=True)
class PythonCodingIssueExecutionPlan:
    """Responsibilities: _AST rule execution inputs_."""

    source_nodes: list[ast.AST]
    rule_stages: list[CallablePythonRuleStage]
    proxy_analyzer: PythonProxyCallableAnalyzerContract


@dataclass
class PythonInheritedFieldResolutionState:
    """Responsibilities: _inheritance graph inputs_, _resolution traversal state_."""

    classes: dict[str, ast.ClassDef]
    own_fields: PythonClassFieldMap
    edges: InheritanceEdges = field(default_factory=dict)
    visiting: list[str] = field(default_factory=list)
    visited: set[str] = field(default_factory=set)
    cycle_names: set[str] = field(default_factory=set)
    memo: PythonClassFieldMap = field(default_factory=dict)


@dataclass(frozen=True)
class PythonArrayCallOptions:
    """Responsibilities: _array source_, _result contract_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    type_inspector: PythonArrayTypeInspectorContract
    return_analyzer: PythonReturnArrayAnalyzerContract
    assignment_aliases: PythonReferenceAliasesContract
    callable_declarations: PythonAstCallableDeclarations
