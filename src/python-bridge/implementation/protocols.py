from __future__ import annotations

import ast
from collections.abc import Callable
from typing import Protocol

from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.types import JsonObject


class PythonAstNodeIndexContract(Protocol):
    """Responsibilities: _define AST node parent_."""

    def nodes(self, root: ast.AST) -> list[ast.AST]: ...

    def children(self, node: ast.AST) -> list[ast.AST]: ...

    def parents(self, node: ast.AST) -> list[ast.AST]: ...

    def scopes(self, root: ast.AST) -> dict[ast.AST, str]: ...


class PythonAsyncNameOverlayContract(Protocol):
    """Responsibilities: _async binding visibility_, _test-local async transitions_."""

    def contains(self, name: str) -> bool: ...

    def add(self, name: str) -> None: ...

    def discard(self, name: str) -> None: ...


class PythonModuleInstanceCollectorContract(Protocol):
    """Responsibilities: _module instance collection contract_."""

    def collect(self) -> list[JsonObject]: ...


class PythonImportNodesContract(Protocol):
    """Responsibilities: _Python import record collection_."""

    def import_records(self) -> list[JsonObject]: ...


class PythonBridgeInputContract(Protocol):
    """Responsibilities: _bridge input source resolution_."""

    def resolve(self, source: str) -> str: ...


class PythonAstSymbolNodesContract(Protocol):
    """Responsibilities: _Python symbol collection contract_."""

    def named_symbols(self) -> list[JsonObject]: ...

    def type_declarations(self) -> list[JsonObject]: ...

    def module_instances(self) -> list[JsonObject]: ...


class PythonFunctionNodesContract(Protocol):
    """Responsibilities: _function node collection_."""

    def nodes(self) -> list[JsonObject]: ...

    def callable_count(self) -> JsonObject: ...


class PythonFunctionSelectorContract(Protocol):
    """Responsibilities: _Python function selection contract_."""

    def nodes(self) -> list[ast.AST]: ...

    def nested(self, node: ast.AST) -> bool: ...


class PythonTypeDeclarationCollectorContract(Protocol):
    """Responsibilities: _type declaration collection contract_."""

    def type_alias_annotation(self, annotation: ast.AST) -> bool: ...

    def declarations(self, nodes: list[ast.AST]) -> list[JsonObject]: ...


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


class PythonAstContentTreeContract(Protocol):
    """Responsibilities: _AST content collection boundary_."""

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonCallableStatementsContract(Protocol):
    """Responsibilities: _callable statement operations contract_."""

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]: ...

    def statement_node(self, node: ast.stmt) -> JsonObject: ...


class PythonTestAssertionDataContract(Protocol):
    """Responsibilities: _test assertion metadata contract_."""

    def collect(
        self, node: ast.AST, callable_statements: PythonCallableStatementsContract
    ) -> JsonObject: ...


class PythonCallableArgumentsContract(Protocol):
    """Responsibilities: _callable argument operations contract_."""

    def callable_arguments(self, node: ast.AST) -> list[ast.arg]: ...

    def argument_metadata(
        self, node: ast.AST, arguments: list[ast.arg], characters: int
    ) -> JsonObject: ...


class PythonCallableMetricsContract(Protocol):
    """Responsibilities: _callable metric operations contract_."""

    def statements_sloc(self, items: list[ast.stmt]) -> int: ...

    def control_flow_depth(self, items: list[ast.stmt]) -> int: ...


class PythonSourceSegmentsContract(Protocol):
    """Responsibilities: _source segment operations contract_."""

    def line(self, line_number: int) -> str: ...

    def character_column(self, line: str, byte_column: int) -> int: ...

    def segment(self, node: ast.AST) -> str: ...

    def significant_characters(self, text: str) -> int: ...


class PythonClassNodeFieldsContract(Protocol):
    """Responsibilities: _Python class field collection_."""

    def fields(self) -> list[JsonObject]: ...

    def untyped_fields(self) -> list[JsonObject]: ...


class PythonPrivateAccessOptionsContract(Protocol):
    """Responsibilities: _private access dependency data_."""

    def data(self) -> JsonObject: ...


class PythonModuleConstantSpansContract(Protocol):
    """Responsibilities: _module declaration span collection_."""

    def collect_spans(self) -> list[JsonObject]: ...

    def collect_types(self) -> list[JsonObject]: ...

    def collect_protocols(self) -> list[JsonObject]: ...


class PythonReferenceCollectorContract(Protocol):
    """Responsibilities: _Python reference collection_."""

    def collect_references(self) -> list[JsonObject]: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonStructureIssuesContract(Protocol):
    """Responsibilities: _AST structure diagnostics_."""

    def deep_attribute_accesses(self, tree: ast.Module) -> list[JsonObject]: ...

    def repeated_branches(self, tree: ast.Module) -> list[JsonObject]: ...


class PythonAstContentContract(Protocol):
    """Responsibilities: _Python AST content collection_."""

    def collect(self) -> JsonObject: ...


class PythonAstTimedResultContract(Protocol):
    """Responsibilities: _AST timing values_."""

    def ast_data(self) -> JsonObject: ...

    def syntax_duration(self) -> float: ...

    def normalization_duration(self) -> float: ...

    def stage_times(self) -> dict[str, float]: ...


class PythonAstBridgeContract(Protocol):
    """Responsibilities: _Python bridge operations_."""

    def source_ast(self, text: str) -> JsonObject: ...

    def source_ast_timed(self, text: str) -> PythonAstTimedResultContract: ...


class PythonPropertyTypeContract(Protocol):
    """Responsibilities: _Python property type resolution_."""

    def annotation_type(self, annotation: ast.AST) -> str: ...

    def init_arguments(self, node: ast.AST) -> dict[str, str]: ...

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str: ...

    def instance_target(self, target: ast.AST) -> bool: ...


class PythonAssignmentEffectsContract(Protocol):
    """Responsibilities: _assignment syntax state_."""

    def assigned_value(self) -> ast.AST: ...

    def declared_annotation(self) -> ast.AST: ...

    def annotation_present(self) -> bool: ...

    def runtime_value_present(self) -> bool: ...


PythonDecoratorAliasGroups = dict[str, set[str]]
PythonRuleStage = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueComponentsContract(Protocol):
    """Responsibilities: _coding issue component boundary_."""

    def precedence_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def prepare(self) -> None: ...

    def global_issues(self) -> list[JsonObject]: ...

    def rule_stages(self) -> list[PythonRuleStage]: ...

    def source_nodes(self) -> list[ast.AST]: ...


class PythonTestOrderDependencyContract(Protocol):
    """Responsibilities: _shared mutable test-state contract_."""

    def module_mutable_names(self) -> set[str]: ...

    def issues(self) -> list[JsonObject]: ...


class PythonCodingIssueComponentContextContract(Protocol):
    """Responsibilities: _Python coding issue context_."""

    def context_data(self) -> JsonObject: ...


class PythonCodingIssueSourceContract(Protocol):
    """Responsibilities: _coding issue source contract_."""

    def source_data(self) -> JsonObject: ...


class PythonCodingIssueAliasesContract(Protocol):
    """Responsibilities: _coding issue aliases contract_."""

    def alias_data(self) -> JsonObject: ...


class PythonUnionRulesContract(Protocol):
    """Responsibilities: _union rule collection_."""

    def collect_union_issues(self, node: ast.AST) -> list[JsonObject]: ...


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


class PythonProxyCallableAnalyzerContract(Protocol):
    """Responsibilities: _proxy callable analysis_."""

    def analyze(self, node: ast.AST) -> list[JsonObject]: ...


class PythonUnnecessaryUndefinedCheckContract(Protocol):
    """Responsibilities: _unnecessary undefined checks_."""

    def collect_checks(self, node: ast.AST) -> list[JsonObject]: ...


class PythonSingleItemArrayStateRulesContract(Protocol):
    """Responsibilities: _single-item array rule collection_."""

    def collect_array_rules(self, node: ast.AST) -> list[JsonObject]: ...


class PythonUnboundedTypeRulesContract(Protocol):
    """Responsibilities: _unbounded type rule collection_."""

    def issues(self) -> list[JsonObject]: ...


class PythonIncompleteCacheKeyContract(Protocol):
    """Responsibilities: _incomplete cache key diagnostics_."""

    def issues(self, tree: ast.Module) -> list[JsonObject]: ...


class PythonDynamicTypeRulesContract(Protocol):
    """Responsibilities: _dynamic type rule collection_."""

    def configure_imports(self, tree: ast.AST) -> None: ...
    def issues(self, node: ast.AST) -> list[JsonObject]: ...


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


class PythonPrivateAccessClassifierContract(Protocol):
    """Responsibilities: _classification external private access_."""

    def private_access(self, node: ast.AST, members: set[str]) -> bool: ...

    def attribute_lines(self, node: ast.AST, members: set[str]) -> set[int]: ...


class PythonPrimaryRulesContract(Protocol):
    """Responsibilities: _primary Python rules_."""

    def stages(self) -> list[PythonRuleStage]: ...

    def prepare(self, tree: ast.AST) -> None: ...

    def branch_count_issues(self, tree: ast.AST) -> list[JsonObject]: ...


class PythonPrimaryTypeStateContract(Protocol):
    """Responsibilities: _primary type state access_."""

    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...
    def dynamic_rules(self) -> PythonDynamicTypeRulesContract: ...
    def exception_aliases(self) -> PythonExceptionAliasStateContract: ...
    def exception_rules(self) -> PythonExceptionRulesContract: ...


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


class PythonReflectionNamesContract(Protocol):
    """Responsibilities: _reflection names contract_."""

    def access_name(self, function: ast.AST) -> str: ...

    def name(self, function: ast.AST) -> str: ...


class PythonCallClassificationContract(Protocol):
    """Responsibilities: _invocation category_."""

    def configure(
        self, tree: ast.AST, node_index: PythonAstNodeIndexContract
    ) -> None: ...

    def kind(self, node: ast.AST) -> str: ...

    def test_function(self, node: ast.AST) -> bool: ...

    def contains_callable_condition(self, node: ast.Call) -> bool: ...


class PythonTemporaryResultAccessContract(Protocol):
    """Responsibilities: _temporary result access policy_."""

    def constructor_result(self, target: ast.AST) -> bool: ...

    def violates(self, node: ast.AST) -> bool: ...


class PythonCallAliasStateContract(Protocol):
    """Responsibilities: _alias state_."""

    def observe(self, node: ast.AST) -> None: ...

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None: ...

    def container_value(self, value: ast.Subscript) -> JsonObject: ...

    def named_value(self, name: str) -> JsonObject: ...


class PythonTypeFactoryNamesContract(Protocol):
    """Responsibilities: _Python type-name resolution contract_."""

    def configure(self, tree: ast.AST) -> None: ...

    def _observe(self, node: ast.AST) -> None: ...

    def matches(self, value: ast.AST) -> bool: ...

    def configure_tuple(self, tree: ast.AST) -> None: ...

    def _observe_tuple(self, node: ast.AST) -> None: ...

    def tuple_annotation(self, value: ast.AST) -> bool: ...


class PythonExceptionMultiplicityContract(Protocol):
    """Responsibilities: _exception multiplicity contract_."""

    def configure(self, targets: list[ast.AST], value: ast.AST) -> None: ...

    def names(self) -> set[str]: ...

    def aliases(self) -> PythonReferenceAliasesContract: ...

    def matches(self, source: ast.AST) -> bool: ...


class PythonDynamicTypeReferencesContract(Protocol):
    """Responsibilities: _dynamic type reference resolution_."""

    def reference_name(self, value: ast.AST) -> str: ...

    def module_reference(self, value: ast.AST) -> str: ...

    def type_call_present(self, value: ast.AST) -> bool: ...


class PythonDecoratorAliasesContract(Protocol):
    """Responsibilities: _decorator alias state contract_."""

    def aliases(self) -> PythonDecoratorAliasGroups: ...

    def container_values(self) -> PythonContainerValuesContract: ...


class PythonAssignedDescriptorIndexContract(Protocol):
    """Responsibilities: _assigned descriptor lookup contract_."""

    def collect(self, tree: ast.AST) -> None: ...

    def kind(self, node: ast.AST) -> str: ...


class PythonDecoratorNameContract(Protocol):
    """Responsibilities: _decorator naming contract_."""

    def expression_name(self, value: ast.AST) -> str: ...

    def imported_name(self, imported: ast.alias) -> str: ...


class PythonPrivateVarsMappingContract(Protocol):
    """Responsibilities: _private mapping access contract_."""

    def supports(self, node: ast.AST) -> bool: ...

    def access(self, node: ast.AST, members: set[str]) -> bool: ...


class PythonArrayTypeInspectorContract(Protocol):
    """Responsibilities: _array type contract_."""

    def array_type(self, annotation: ast.AST) -> bool: ...


class PythonReturnArrayAnalyzerContract(Protocol):
    """Responsibilities: _array result contract_."""

    def single_arrays(self, node: ast.AST) -> bool: ...


class PythonScopeAliasHistoryContract(Protocol):
    """Responsibilities: _scoped alias index contract_."""

    def resolve(self, node: ast.AST, name: str, line: int) -> JsonObject: ...


class PythonAssignmentAliasContract(Protocol):
    """Responsibilities: _assignment alias source contract_."""

    def assignment_aliases(self, node: ast.AST) -> dict[str, str]: ...


class PythonArrayCallAnalyzerContract(Protocol):
    """Responsibilities: _array index category_."""

    def array_call(self, node: ast.Subscript) -> bool: ...


class PythonUndefinedCheckStateContract(Protocol):
    """Responsibilities: _undefined check state contract_."""

    def bindings(self) -> dict: ...

    def fields(self) -> dict: ...


class PythonProxyTargetContract(Protocol):
    """Responsibilities: _proxy target contract_."""

    def property_decorated(self, node: ast.AST) -> bool: ...

    def supported_target(self, call: ast.Call) -> bool: ...


class PythonProxyReceiverAliasesContract(Protocol):
    """Responsibilities: _proxy receiver alias contract_."""

    def lambda_receiver(self, node: ast.AST) -> bool: ...


class PythonProxyScopeAliasIndexContract(Protocol):
    """Responsibilities: _proxy scope alias lookup_."""

    def value(self, name: str, line: int) -> str: ...

    def resolve(self, name: str, line: int) -> str: ...


class PythonDecoratorRulesContract(Protocol):
    """Responsibilities: _Python decorator rule contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def kinds(self, node: ast.AST) -> set[str]: ...


class PythonPropertyDecoratorContract(Protocol):
    """Responsibilities: _property decorator classification contract_."""

    def property_decorator(self, decorator: ast.AST) -> bool: ...


class PythonContainerKeysContract(Protocol):
    """Responsibilities: _container key extraction contract_."""

    def static_key(self, value: ast.AST) -> str: ...


class PythonSubtestAliasesContract(Protocol):
    """Responsibilities: _subtest alias matching contract_."""

    def matches(self, node: ast.AST) -> bool: ...


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


class PythonExceptionAliasStateContract(Protocol):
    """Responsibilities: _exception alias state contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def select(self, node: ast.AST) -> None: ...

    def exception_names(self) -> set[str]: ...
    def configure_imports(self, tree: ast.AST) -> None: ...


class PythonExceptionBroadnessContract(Protocol):
    """Responsibilities: _broad exception contract_."""

    def snapshot(
        self, multi_names: frozenset[str]
    ) -> PythonExceptionAliasSnapshotContract: ...

    def restore_snapshot(
        self, snapshot: PythonExceptionAliasSnapshotContract
    ) -> None: ...

    def observe_alias(self, source: str, target: str, broad: bool = False) -> None: ...

    def broad(self, node: ast.AST) -> bool: ...

    def observe(self, node: ast.AST) -> None: ...


class PythonExceptionAliasSnapshotContract(Protocol):
    """Responsibilities: _exception aliases_, _builtin module aliases_."""

    def exception_names(self) -> frozenset[str]: ...

    def module_names(self) -> frozenset[str]: ...

    def restore(
        self,
        broadness: PythonExceptionBroadnessContract,
        multi_exception_names: set[str],
    ) -> None: ...


class PythonSysPathAliasesContract(Protocol):
    """Responsibilities: _sys path alias contract_."""

    def system_name(self, name: str) -> bool: ...

    def path_name(self, name: str) -> bool: ...

    def path_mutating(self, name: str) -> bool: ...

    def path_mutator_name(self, name: str) -> bool: ...


class PythonSysPathReferencesContract(Protocol):
    """Responsibilities: _sys path references contract_."""

    def path_alias_assignment(self, node: ast.AST) -> bool: ...

    def path_call(self, node: ast.Call) -> bool: ...


class PythonSysPathRulesContract(Protocol):
    """Responsibilities: _sys path rules contract_."""

    def configure(self, tree: ast.Module) -> None: ...

    def path_mutation(self, node: ast.AST) -> bool: ...


class PythonImportRulesContract(Protocol):
    """Responsibilities: _Python import diagnostics contract_."""

    def import_issues(self, tree: ast.Module) -> list[JsonObject]: ...
