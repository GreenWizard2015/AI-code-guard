from __future__ import annotations

import ast
from collections.abc import Sequence
from typing import Protocol, TYPE_CHECKING
from implementation.types import PythonRuleStage

if TYPE_CHECKING:
    from implementation.rules.types import AliasWalkStateDataContract
    from implementation.types import JsonObject
    from implementation.ast.protocols import PythonSubtestAliasesContract
    from implementation.protocols import PythonProxyCallableAnalyzerContract
    from implementation.references.protocols import PythonContainerAliasesContract
    from implementation.ast.protocols import PythonTestOrderDependencyContract


class PythonMethodRecordContract(Protocol):
    """Responsibilities: _method temporal record contract_."""

    def method_name(self) -> str: ...

    def syntax_node(self) -> ast.AST: ...

    def written_set(self) -> set[str]: ...

    def access_set(self) -> set[str]: ...


class PythonCacheReadStateContract(Protocol):
    """Responsibilities: _cache key state_."""

    def record(self, receiver: str, key: str) -> None:
        """Responsibilities: _cache read recording_."""
        ...

    def keys_for(self, receiver: str) -> set[str]:
        """Responsibilities: _receiver key lookup_."""
        ...

    def entries(self) -> set[str]:
        """Responsibilities: _branch state snapshot_."""
        ...

    def merge(
        self, states: list[PythonCacheReadStateContract]
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _branch state combination_."""
        ...


class PythonCacheDiagnosticsContract(Protocol):
    """Responsibilities: _cache diagnostic collection contract_."""

    def clear(self) -> None:
        """Responsibilities: _diagnostic state reset_."""
        ...

    def append(self, line: int) -> None:
        """Responsibilities: _cache diagnostic recording_."""
        ...

    def values(self) -> list[JsonObject]:
        """Responsibilities: _cache diagnostic results_."""
        ...


class PythonCacheNodeExecutionContract(Protocol):
    """Responsibilities: _cache AST execution order_."""

    def analyze_node(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract: ...

    def analyze_nodes(
        self, nodes: Sequence[ast.AST], state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract: ...


class AliasWalkStateContract(Protocol):
    """Responsibilities: _alias traversal contract_."""

    def snapshot(self) -> AliasWalkStateDataContract: ...

    def known_result(self) -> AliasWalkStateContract: ...

    def with_result(self, result: ast.expr) -> AliasWalkStateContract: ...

    def visit(self, source: str) -> AliasWalkStateContract: ...

    def cycle_result(self, cycle_start: int) -> AliasWalkStateContract: ...


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

    def precedence_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def prepare(self) -> None: ...

    def global_issues(self) -> list[JsonObject]: ...

    def rule_stages(self) -> list[PythonRuleStage]: ...

    def source_nodes(self) -> list[ast.AST]: ...


class PythonCodingIssueComponentContextContract(Protocol):
    """Responsibilities: _Python coding issue context_."""

    def context_data(self) -> JsonObject: ...


class PythonCodingIssueSourceContract(Protocol):
    """Responsibilities: _coding issue source contract_."""

    def source_data(self) -> JsonObject: ...


class PythonCodingIssueAliasesContract(Protocol):
    """Responsibilities: _coding issue aliases contract_."""

    def alias_data(self) -> JsonObject: ...


class PythonFieldMutationCollectorContract(Protocol):
    """Responsibilities: _field mutation collection_."""

    def prepare(self) -> None: ...

    def prepare_parent_index(self) -> None: ...

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


class PythonCodingIssueFlowStateContract(Protocol):
    """Responsibilities: _flow state access_."""

    def control_flow(self) -> PythonControlFlowIssuesContract: ...

    def precedence(self) -> PythonOperatorPrecedenceContract: ...


class PythonCodingIssueTestStateContract(Protocol):
    """Responsibilities: _test state access_."""

    def subtest_aliases(self) -> PythonSubtestAliasesContract: ...

    def simple_stages(self) -> PythonCodingIssueStagesContract: ...

    def test_order(self) -> PythonTestOrderDependencyContract: ...


class PythonCallRulesContract(Protocol):
    """Responsibilities: _invocation rules_."""

    def assertion_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def prepare(self) -> None: ...

    def temporary_access_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def special_method_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonCodingIssueOptionsContract(Protocol):
    """Responsibilities: _coding issue dependency data_."""

    def source_data(self) -> JsonObject: ...

    def alias_data(self) -> JsonObject: ...

    def rule_data(self) -> JsonObject: ...


class PythonDuplicateSetupContract(Protocol):
    """Responsibilities: _duplicate test setup contract_."""

    def issues(self, node: ast.AST) -> list[JsonObject]: ...

    def body_issues(self, statements: list[ast.stmt]) -> list[JsonObject]: ...


class PythonExpressionBoundaryContract(Protocol):
    """Responsibilities: _expression boundary contract_."""

    def negation_comparison_boundary(self, node: ast.AST) -> bool: ...

    def parenthesized(self, node: ast.AST) -> bool: ...

    def ungrouped(self, node: ast.AST, root_parenthesized: bool = False) -> bool: ...


class PythonPredicateConditionContract(Protocol):
    """Responsibilities: _predicate condition contract_."""

    def violation(
        self,
        node: ast.BoolOp,
        parent: ast.AST,
        assignment_values: set[int],
    ) -> list[JsonObject]: ...


class PythonTerminalBranchContract(Protocol):
    """Responsibilities: _terminal branch contract_."""

    def terminal_block(self, statements: list[ast.stmt]) -> bool: ...


class PythonAssignmentEffectsContract(Protocol):
    """Responsibilities: _assignment syntax state_."""

    def assigned_value(self) -> ast.AST: ...

    def declared_annotation(self) -> ast.AST: ...

    def annotation_present(self) -> bool: ...

    def runtime_value_present(self) -> bool: ...


class PythonExceptionRulesContract(Protocol):
    """Responsibilities: _exception rule collection_."""

    def try_statement_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonControlFlowIssuesContract(Protocol):
    """Responsibilities: _control-flow issue collection_."""

    def conditional_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def elif_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def walrus_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonOperatorPrecedenceContract(Protocol):
    """Responsibilities: _operator precedence analysis_."""

    def mixed_boolean_operator(self, node: ast.AST) -> list[JsonObject]: ...

    def mixed_arithmetic_operator(self, node: ast.AST) -> list[JsonObject]: ...


class PythonPrimaryRulesContract(Protocol):
    """Responsibilities: _primary Python rules_."""

    def stages(self) -> list[PythonRuleStage]: ...

    def prepare(self, tree: ast.AST) -> None: ...

    def branch_count_issues(self, tree: ast.AST) -> list[JsonObject]: ...


class PythonTypeDeclarationCollectorContract(Protocol):
    """Responsibilities: _type declaration collection contract_."""

    def type_alias_annotation(self, annotation: ast.AST) -> bool: ...

    def declarations(self, nodes: list[ast.AST]) -> list[JsonObject]: ...


class PythonPropertyTypeContract(Protocol):
    """Responsibilities: _Python property type resolution_."""

    def annotation_type(self, annotation: ast.AST) -> str: ...

    def init_arguments(self, node: ast.AST) -> dict[str, str]: ...

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str: ...

    def instance_target(self, target: ast.AST) -> bool: ...


class PythonUnionRulesContract(Protocol):
    """Responsibilities: _union rule collection_."""

    def collect_union_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonUnnecessaryUndefinedCheckContract(Protocol):
    """Responsibilities: _unnecessary undefined checks_."""

    def collect_checks(self, node: ast.AST) -> list[JsonObject]: ...


class PythonSingleItemArrayStateRulesContract(Protocol):
    """Responsibilities: _single-item array rule collection_."""

    def collect_array_rules(self, node: ast.AST) -> list[JsonObject]: ...


class PythonUnboundedTypeRulesContract(Protocol):
    """Responsibilities: _unbounded type diagnostics_."""

    def issues(self) -> list[JsonObject]: ...


class PythonIncompleteCacheKeyContract(Protocol):
    """Responsibilities: _incomplete cache key diagnostics_."""

    def issues(self, tree: ast.Module) -> list[JsonObject]: ...


class PythonDynamicTypeRulesContract(Protocol):
    """Responsibilities: _dynamic type rule collection_."""

    def configure_imports(self, tree: ast.AST) -> None: ...

    def issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonArrayTypeInspectorContract(Protocol):
    """Responsibilities: _array type contract_."""

    def array_type(self, annotation: ast.AST) -> bool: ...


class PythonReturnArrayAnalyzerContract(Protocol):
    """Responsibilities: _array result contract_."""

    def single_arrays(self, node: ast.AST) -> bool: ...


class PythonArrayCallAnalyzerContract(Protocol):
    """Responsibilities: _array index category_."""

    def array_call(self, node: ast.Subscript) -> bool: ...


class PythonUndefinedCheckStateContract(Protocol):
    """Responsibilities: _undefined check state contract_."""

    def bindings(self) -> dict: ...

    def fields(self) -> dict: ...


class PythonTypingAliasesContract(Protocol):
    """Responsibilities: _typing alias contract_."""

    def expression_name(
        self, value: ast.AST, container_aliases: PythonContainerAliasesContract
    ) -> str: ...

    def matches_optional(self, name: str) -> bool: ...

    def matches_union(self, name: str) -> bool: ...


class PythonUnionAnnotationRulesContract(Protocol):
    """Responsibilities: _union annotation diagnostics contract_."""

    def requires_analysis(
        self, annotation: ast.AST, is_field: bool = False
    ) -> bool: ...

    def issues_for_annotation(
        self, annotation: ast.AST, is_field: bool = False
    ) -> list[JsonObject]: ...
