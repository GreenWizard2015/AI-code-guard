from __future__ import annotations

import ast
from typing import TYPE_CHECKING, Protocol

from implementation.rules.control_flow.protocols import (
    PythonAssignmentEffectsContract,
    PythonCodingIssueFlowStateContract,
    PythonControlFlowIssuesContract,
    PythonExceptionHandlerAssignmentsContract,
    PythonExceptionRulesContract,
    PythonExpressionBoundaryContract,
    PythonLogicalChainAnalysisContract,
    PythonOperatorPrecedenceContract,
    PythonTerminalBranchContract,
)
from implementation.rules.type_rule_protocols import (
    PythonArrayCallAnalyzerContract,
    PythonArrayTypeInspectorContract,
    PythonDynamicTypeRulesContract,
    PythonPropertyTypeContract,
    PythonReturnArrayAnalyzerContract,
    PythonSingleItemArrayStateRulesContract,
    PythonTypingAliasesContract,
    PythonUnboundedTypeRulesContract,
    PythonUndefinedCheckStateContract,
    PythonUnionAnnotationRulesContract,
    PythonUnionRulesContract,
    PythonUnnecessaryUndefinedCheckContract,
)
from implementation.types import (
    CallablePythonRuleStage,
    PythonNameSetIndex,
)


class PythonNameBindingIndexContract(Protocol):
    """Responsibilities: _module binding state_, _callable local names_."""

    def index_tree(self) -> None: ...

    def module_binding(self, name: str) -> str: ...

    def function_binds(self, function: ast.AST, name: str) -> bool: ...


__all__ = [
    "PythonArrayCallAnalyzerContract",
    "PythonArrayTypeInspectorContract",
    "PythonAssignmentEffectsContract",
    "PythonCodingIssueFlowStateContract",
    "PythonControlFlowIssuesContract",
    "PythonDynamicTypeRulesContract",
    "PythonExceptionHandlerAssignmentsContract",
    "PythonExceptionRulesContract",
    "PythonExpressionBoundaryContract",
    "PythonLogicalChainAnalysisContract",
    "PythonOperatorPrecedenceContract",
    "PythonPropertyTypeContract",
    "PythonReturnArrayAnalyzerContract",
    "PythonSingleItemArrayStateRulesContract",
    "PythonTerminalBranchContract",
    "PythonTypingAliasesContract",
    "PythonUnboundedTypeRulesContract",
    "PythonUndefinedCheckStateContract",
    "PythonUnionAnnotationRulesContract",
    "PythonUnionRulesContract",
    "PythonUnnecessaryUndefinedCheckContract",
]

if TYPE_CHECKING:
    from implementation.ast.callables.coding_issue_protocols import (
        PythonCodingIssueContainerAliasesContract,
        PythonCodingIssueValueAliasesContract,
    )
    from implementation.ast.protocols import (
        PythonAstNodeIndexContract,
        PythonSourceSegmentsContract,
        PythonSubtestAliasesContract,
        PythonTestOrderDependencyContract,
    )
    from implementation.protocols import (
        PythonProxyCallableAnalyzerContract,
    )
    from implementation.references.decorator_protocols import (
        PythonAssignedDescriptorIndexContract,
    )
    from implementation.types import (
        JsonObject,
        PythonDecoratorAliasGroups,
    )


class PythonMethodRecordContract(Protocol):
    """Responsibilities: _method temporal record contract_."""

    def method_name(self) -> str: ...

    def syntax_node(self) -> ast.AST: ...

    def written_set(self) -> set[str]: ...

    def access_set(self) -> set[str]: ...


class PythonStructuralMemberLookupContract(Protocol):
    """Responsibilities: _Protocol implementation lookup_."""

    def contains(self, name: str) -> bool: ...

    def implementation_contracts(self, class_name: str) -> PythonNameSetIndex: ...

    def members(self, name: str) -> set[str]: ...

    def prepare(self) -> None: ...


class AliasWalkStateContract(Protocol):
    """Responsibilities: _alias traversal contract_."""

    def snapshot(self) -> AliasWalkStateDataContract: ...

    def known_result(self) -> AliasWalkStateContract: ...

    def with_result(self, result: ast.expr) -> AliasWalkStateContract: ...

    def visit(self, source: str) -> AliasWalkStateContract: ...

    def cycle_result(self, cycle_start: int) -> AliasWalkStateContract: ...


class AliasWalkStateDataContract(Protocol):
    """Responsibilities: _alias traversal input_, _alias traversal snapshot_."""

    @property
    def current(self) -> str: ...

    @property
    def aliases(self) -> dict[str, str]: ...

    @property
    def bindings(self) -> dict[str, ast.expr]: ...

    @property
    def resolution_map(self) -> dict[str, ast.expr]: ...

    @property
    def path(self) -> list[str]: ...

    @property
    def positions(self) -> dict[str, int]: ...

    @property
    def result(self) -> ast.expr: ...

    @property
    def result_present(self) -> bool: ...


class PythonCodingIssueTypeBundleContract(Protocol):
    """Responsibilities: _type rule bundle access_."""

    @property
    def union_rules(self) -> PythonUnionRulesContract: ...

    @property
    def unbounded_type_rules(self) -> PythonUnboundedTypeRulesContract: ...


class PythonCodingIssueStructureBundleContract(Protocol):
    """Responsibilities: _structure rule bundle access_."""

    @property
    def subtest_aliases(self) -> PythonSubtestAliasesContract: ...

    @property
    def control_flow(self) -> PythonControlFlowIssuesContract: ...

    @property
    def python_operator_precedence(self) -> PythonOperatorPrecedenceContract: ...

    @property
    def simple_stages(self) -> PythonCodingIssueStagesContract: ...

    @property
    def source_nodes(self) -> list[ast.AST]: ...

    @property
    def test_order_dependency(self) -> PythonTestOrderDependencyContract: ...


class PythonCodingIssueBoundaryBundleContract(Protocol):
    """Responsibilities: _boundary rule bundle access_."""

    @property
    def field_mutations(self) -> PythonFieldMutationCollectorContract: ...

    @property
    def proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract: ...

    @property
    def unnecessary_undefined_check(
        self,
    ) -> PythonUnnecessaryUndefinedCheckContract: ...


class PythonCodingIssueAssemblyBundleContract(Protocol):
    """Responsibilities: _rule bundle access_."""

    @property
    def type_state(self) -> PythonCodingIssueTypeBundleContract: ...

    @property
    def boundary_state(self) -> PythonCodingIssueBoundaryBundleContract: ...

    @property
    def structure_state(self) -> PythonCodingIssueStructureBundleContract: ...

    @property
    def array_state_rules(self) -> PythonSingleItemArrayStateRulesContract: ...


class PythonCodingIssueExecutionPlanContract(Protocol):
    """Responsibilities: _AST rule execution inputs_."""

    @property
    def source_nodes(self) -> list[ast.AST]: ...

    @property
    def rule_stages(self) -> list[CallablePythonRuleStage]: ...

    @property
    def proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract: ...


class BranchSummaryContract(Protocol):
    """Responsibilities: _branch-chain summary contract_."""

    def length(self) -> int:
        """Responsibilities: _branch-chain length access_."""
        ...

    def all_same(self) -> bool:
        """Responsibilities: _branch condition equality access_."""
        ...

    def prepend(self, name: str) -> BranchSummaryContract:
        """Responsibilities: _immutable branch summary extension_."""
        ...


class PythonCodingIssueComponentsContract(Protocol):
    """Responsibilities: _coding issue component boundary_."""

    def execution_plan(self) -> PythonCodingIssueExecutionPlanContract: ...

    def precedence_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def prepare(self) -> None: ...

    def phase_timings(self) -> dict[str, float]: ...

    def global_issues(self) -> list[JsonObject]: ...


class PythonGlobalIssueCollectorContract(Protocol):
    """Responsibilities: _global rule issue collection_."""

    def collection_issues(self) -> list[JsonObject]: ...

    def state_issues(self) -> list[JsonObject]: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonModuleIssueRuleContract(Protocol):
    """Responsibilities: _module rule analysis_."""

    def issues(self, tree: ast.Module) -> list[JsonObject]: ...


class PythonCodingIssueComponentContextContract(Protocol):
    """Responsibilities: _Python coding issue context_."""

    def tree(self) -> ast.AST: ...

    def node_index(self) -> PythonAstNodeIndexContract: ...

    def source_text(self) -> str: ...

    def source_segments(self) -> PythonSourceSegmentsContract: ...

    def expression_boundary(self) -> PythonExpressionBoundaryContract: ...

    def aliases(self) -> PythonCodingIssueAliasesContract: ...

    def terminal_branches(self) -> PythonTerminalBranchContract: ...


class PythonConstructorRulesContract(Protocol):
    """Responsibilities: _constructor field rule collection_."""

    def collect_constructor_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def field_constructor_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonDecoratorAliasStateContract(Protocol):
    """Responsibilities: _decorator alias observation_."""

    def assigned_descriptors(self) -> PythonAssignedDescriptorIndexContract: ...

    def aliases(self) -> PythonDecoratorAliasGroups: ...

    def observe(self, node: ast.AST) -> None: ...

    def observe_module(self, tree: ast.AST) -> None: ...


class PythonDecoratorRuleContract(Protocol):
    """Responsibilities: _decorator rule operations_."""

    def kinds(self, node: ast.AST) -> list[str]: ...

    def property_decorator(self, decorator: ast.AST) -> bool: ...


class PythonCallClassifierContract(Protocol):
    """Responsibilities: _call category classification_."""

    def kind(self, node: ast.AST) -> str: ...


class PythonCodingIssueSourceContract(Protocol):
    """Responsibilities: _coding issue source contract_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def source(self) -> str: ...

    @property
    def source_segments(self) -> PythonSourceSegmentsContract: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...


class PythonCodingIssueAliasesContract(Protocol):
    """Responsibilities: _coding issue aliases contract_."""

    @property
    def containers(self) -> PythonCodingIssueContainerAliasesContract: ...

    @property
    def values(self) -> PythonCodingIssueValueAliasesContract: ...


class PythonCodingIssueRulesContract(Protocol):
    """Responsibilities: _coding issue rule dependencies_."""

    @property
    def terminal_branches(self) -> PythonTerminalBranchContract: ...


class PythonFieldMutationCollectorContract(Protocol):
    """Responsibilities: _field mutation collection_."""

    def collect_mutations(self, node: ast.AST) -> list[JsonObject]: ...


class PythonCodingIssueBoundaryStateContract(Protocol):
    """Responsibilities: _boundary analyzer access_."""

    def field_mutations(self) -> PythonFieldMutationCollectorContract: ...

    def proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract: ...

    def unnecessary_undefined_check(
        self,
    ) -> PythonUnnecessaryUndefinedCheckContract: ...


class PythonCodingIssueStagesContract(Protocol):
    """Responsibilities: _simple Python rule stages_."""

    def shape_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def property_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def exception_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def subtest_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonCodingIssueTestStateContract(Protocol):
    """Responsibilities: _test state access_."""

    def subtest_aliases(self) -> PythonSubtestAliasesContract: ...

    def simple_stages(self) -> PythonCodingIssueStagesContract: ...

    def test_order(self) -> PythonTestOrderDependencyContract: ...


class PythonCallRulesContract(Protocol):
    """Responsibilities: _invocation rules_."""

    def issues(self, source_node: ast.AST) -> list[JsonObject]: ...

    def configure_reflection(self) -> None: ...


class PythonDowncastAnalysisContract(Protocol):
    """Responsibilities: _Protocol downcast analysis_."""

    def prepare(self) -> None: ...

    def issue(self, call: ast.AST) -> JsonObject: ...


class PythonTypeRulesContract(Protocol):
    """Responsibilities: _Python type diagnostics_."""

    def prepare(self) -> None: ...

    def collect_type_issues(self, syntax_node: ast.AST) -> list[JsonObject]: ...

    def collect_generic_types(
        self,
        callable_definition: ast.AST,
    ) -> list[JsonObject]: ...


class PythonCodingIssueOptionsContract(Protocol):
    """Responsibilities: _coding issue dependency data_."""

    @property
    def source(self) -> PythonCodingIssueSourceContract: ...

    @property
    def aliases(self) -> PythonCodingIssueAliasesContract: ...

    @property
    def rules(self) -> PythonCodingIssueRulesContract: ...
