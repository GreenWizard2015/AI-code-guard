import type { ReadonlyStringSetMap } from "src/analysis_types";
import type { CallableClassIndex, ParsedFile } from "src/metrics/types";
import type {
	AstCallableNode,
	AstClassNode,
	AstTypeMemberRecord,
	DuplicateTypeShape,
	NamedLine,
	NamedSymbol,
} from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableOwnershipRequest, RuleContextContract } from "src/types";
import type { TypeScriptStaticArrayValuesContract } from "src/typescript_analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _temporal field reader ownership_, _reader lookup_. **/
export interface TemporalFieldReaderIndexContract {
	add(field: string, callable_index: number): void;
	different_callable_reads(field: string, callable_index: number): boolean;
}

/** Responsibilities: _source file discovery_. **/
export interface LintFileDiscoveryContract {
	walk_files_from(paths: readonly string[]): string[];
}

/** Responsibilities: _process signal handling_. **/
export type ProcessId = { value: number };
/** Responsibilities: _process liveness_. **/
export interface ProcessLivenessContract {
	pid_exists(process_id: ProcessId): boolean;
}

/** Responsibilities: _operating-system process signaling_. **/
export interface ProcessKillContract {
	kill(pid: number, signal: number): boolean;
}

/** Responsibilities: _process signal handling_. **/
export type ProcessGroupReference = { id: number };
export type OwnedProcessGroup = { id: number; token: string };

/** Responsibilities: _process signal handling_. **/
export interface ProcessSignalContract extends ProcessLivenessContract {
	group_exists(group: ProcessGroupReference): boolean;
	group_contains_token(owner: OwnedProcessGroup): boolean;
	terminate_owned_group(ownership: OwnedProcessGroup): boolean;
	terminate_group(target: ProcessGroupReference): boolean;
}

/** Responsibilities: _boundary failure categories_. **/
export enum BoundaryFailureCategory {
	System = "system",
	Permission = "permission",
	MissingProcess = "missing-process",
	CacheRead = "cache-read",
	JsonParse = "json-parse",
}

/** Responsibilities: _operating-system failure classification_. **/
export interface SystemFailureClassificationContract {
	check(message: string, category: BoundaryFailureCategory): boolean;
}

/** Responsibilities: _method order validation_. **/
export interface MethodOrderContract {
	append_order(violations: ViolationContract[]): void;
}

/** Responsibilities: _symbol naming validation_. **/
export interface NamingSupportContract {
	append_symbol_violations(violations: ViolationContract[]): void;
	append_type_violations(violations: ViolationContract[]): void;
	append_numeric_violations(violations: ViolationContract[]): void;
}

/** Responsibilities: _name validation_. **/
export interface NamingValidationContract {
	append_standard_violation(violations: ViolationContract[], symbol: NamedSymbol): void;
	append_type_violation(violations: ViolationContract[], declaration: NamedLine): void;
	numeric_name_violation(line: number): ViolationContract;
}

/** Responsibilities: _numeric name violation aggregation_. **/
export type NumericNameReportingContext = {
	readonly violations: ViolationContract[];
	readonly reported: Set<string>;
};

/** Responsibilities: _source-qualified callable identity resolution_. **/
export interface CallableSourceIdentityGraphContract {
	index_sources(parsed_files: readonly ParsedFile[]): void;
	class_ancestors(identity: string): Set<string>;
	concrete_descendants(class_nodes: CallableClassIndex): ReadonlyStringSetMap;
	visible_type_members(type_name: string, source_file: string): string[];
	class_identities(name: string, source_file: string): string[];
}

/** Responsibilities: _concrete descendant relationships lookup_. **/
export interface CallableConcreteDescendantIndexContract {
	present(right_ids: readonly string[], left: string, identities: CallableSourceIdentityGraphContract): boolean;
}

/** Responsibilities: _callable owner matching graph_. **/
export interface CallableOwnershipMatchGraphContract {
	match(request: CallableOwnershipRequest): boolean;
}

/** Responsibilities: _callable import scope resolution_. **/
export interface CallableSourceImportScopeContract {
	imports_for(file: string): ReadonlySet<string>;
	scope_files(file: ParsedFile): ReadonlySet<string>;
}

/** Responsibilities: _static array source expansion_. **/
export interface StaticArraySourceAppenderContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
}

/** Responsibilities: _recursive static array ownership_, _array source expansion_. **/
export interface StaticArrayExpressionOwnerContract extends TypeScriptStaticArrayValuesContract {}

/** Responsibilities: _lazy static array values_. **/
export interface StaticExpressionArrayContract {
	size(): bigint;
	contains(index: bigint): boolean;
	at(index: bigint): ts.Expression;
	slice(start: number): StaticExpressionArrayContract;
	append_to(target: ts.Expression[]): void;
}

/** Responsibilities: _static array index values_. **/
export type StaticExpressionArrayIndex = {
	readonly value: bigint;
};

/** Responsibilities: _static array source candidate_. **/
export type StaticArraySourceCandidate = {
	readonly name: string;
	readonly current: ts.Expression;
};

/** Responsibilities: _static array assignment values_. **/
export type StaticArrayAssignment = {
	readonly name: string;
	readonly values: StaticExpressionArrayContract;
};

/** Responsibilities: _pointless assignment rule collection_. **/
export interface PointlessAssignmentsContract {
	append_assignment_violations(): void;
}

/** Responsibilities: _TypeScript callable node construction_. **/
export interface CallableNodesContract {
	interface_node(node: ts.InterfaceDeclaration): AstClassNode;
	class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNode[];
	variable_callable_nodes(statement: ts.VariableStatement): AstCallableNode[];
	function_declaration_node(statement: ts.FunctionDeclaration): AstCallableNode;
}

/** Responsibilities: _private member names_. **/
/** Responsibilities: _unnecessary undefined-check rule collection_. **/
export interface UnnecessaryUndefinedCheckContract {
	append(node: ts.Node): void;
}

/** Responsibilities: _undefined check candidate classification_. **/
/** Responsibilities: _duplicate type-shape collection_. **/
export interface DuplicateTypeShapesContract {
	typescript(source_file: ts.SourceFile): readonly DuplicateTypeShape[];
	python(classes: readonly AstClassNode[]): readonly DuplicateTypeShape[];
}

/** Responsibilities: _proxy rule classification_. **/
export interface ProxyRulesContract {
	proxy_callable(node: ts.Node): boolean;
	proxy_lambda(node: ts.Node): boolean;
}

/** Responsibilities: _value rule classification_. **/
export interface ValueRulesContract {
	repeated_typeof(node: ts.TypeOfExpression): boolean;
	typed_primitive(expression: ts.Expression, source_file: ts.SourceFile): boolean;
	dynamic_class(node: ts.Node): boolean;
}

/** Responsibilities: _rest union rule classification_. **/
export interface RestUnionRuleContract {
	rest_parameter(node: ts.Node): boolean;
	append_rule(node: ts.Node, context: RuleContextContract): void;
}

/** Responsibilities: _source-qualified callable symbol lookup_. **/
export interface CallableSymbolIndexContract {
	types_named(name: string, source_file: string): AstTypeMemberRecord[];
	type_members(type_name: string, source_file: string): string[];
	type_member_names(type_name: string, source_file: string): ReadonlySet<string>;
}
