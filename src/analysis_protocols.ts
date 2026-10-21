import type { CallableClassIndex, ParsedFile } from "src/metrics/types";
import type {
	AstCallableNodeContract,
	AstClassNodeContract,
	AstTypeMemberRecord,
	DuplicateTypeShape,
	NamedLine,
	NamedSymbol,
	RuleAppender,
	RuleContextData,
} from "src/types";
import type ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type { ReadonlyStringSetMap } from "src/analysis_types";
import type { TypeScriptStaticArrayValuesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _source file discovery_. **/
export interface LintFileDiscoveryContract {
	walk_files_raw(repo_root: string, root: string, ignored_directories: ReadonlySet<string>): string[];
}

/** Responsibilities: _process signal handling_. **/
export interface ProcessSignalContract {
	pid_exists(pid: number): boolean;
	group_exists(pid: number): boolean;
	terminate_group(pid: number): void;
}

/** Responsibilities: _operating-system failure classification_. **/
export interface SystemFailureClassificationContract {
	system_failure_message(message: string): boolean;
	permission_denied(message: string): boolean;
	json_parse_failure(message: string): boolean;
}

/** Responsibilities: _method order validation_. **/
export interface MethodOrderContract {
	append_order_violations(violations: ViolationContract[], file: string, node: AstClassNodeContract): void;
}

/** Responsibilities: _symbol naming validation_. **/
export interface NamingSupportContract {
	append_naming_violations(
		violations: ViolationContract[],
		file: string,
		symbols: NamedSymbol[],
		classes: AstClassNodeContract[],
		type_declarations: NamedLine[],
	): void;
}

/** Responsibilities: _name validation_. **/
export interface NamingValidationContract {
	name_words(name: string): string[];
	valid_name(name: string, kind: string, is_module_constant: boolean, words: string[], visibility: string): boolean;
	append_standard_violation(violations: ViolationContract[], file: string, symbol: NamedSymbol): void;
	numeric_name_violation(file: string, line: number): ViolationContract;
	naming_violation(file: string, line: number, name: string, kind: string, word_count: number): ViolationContract;
}

/** Responsibilities: _source-qualified callable identity resolution_. **/
export interface CallableSourceIdentityGraphContract {
	index_sources(parsed_files: readonly ParsedFile[]): void;
	class_ancestors(identity: string): Set<string>;
	concrete_descendants(class_nodes: CallableClassIndex): ReadonlyStringSetMap;
	visible_type_members(type_name: string, source_file: string): string[];
	class_identities(name: string, source_file: string): string[];
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

/** Responsibilities: _lazy static array values_, _indexed expression access_. **/
export interface StaticExpressionArrayContract {
	readonly size: bigint;
	contains(index: bigint): boolean;
	at(index: bigint): ts.Expression;
	slice(start: number): StaticExpressionArrayContract;
	append_to(target: ts.Expression[]): void;
}

/** Responsibilities: _pointless assignment rule collection_. **/
export interface PointlessAssignmentsContract {
	append_assignment_violations(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _private member rule collection_. **/
export interface PrivateMemberAccessContract {
	append_private_access(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
	): void;
}

/** Responsibilities: _TypeScript callable node construction_. **/
export interface CallableNodesContract {
	interface_node(node: ts.InterfaceDeclaration): AstClassNodeContract;
	class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNodeContract[];
	variable_callable_nodes(statement: ts.VariableStatement): AstCallableNodeContract[];
	function_declaration_node(statement: ts.FunctionDeclaration): AstCallableNodeContract;
}

/** Responsibilities: _private member names_. **/
export interface PrivateMemberDeclarationNamesContract {
	name(member: ts.ClassElement, source_file: ts.SourceFile): string;
	names(member: ts.ClassElement, source_file: ts.SourceFile): string[];
}

/** Responsibilities: _unnecessary undefined-check rule collection_. **/
export interface UnnecessaryUndefinedCheckContract {
	append(node: ts.Node): void;
}

/** Responsibilities: _undefined check candidate classification_. **/
export interface UndefinedCheckCandidateContract {
	matches(node: ts.Node): boolean;
}

/** Responsibilities: _duplicate type-shape collection_. **/
export interface DuplicateTypeShapesContract {
	typescript(source_file: ts.SourceFile): DuplicateTypeShape[];
	python(classes: readonly AstClassNodeContract[]): DuplicateTypeShape[];
}

/** Responsibilities: _proxy rule classification_. **/
export interface ProxyRulesContract {
	proxy_callable(node: ts.Node): boolean;
	proxy_lambda(node: ts.Node): boolean;
}

/** Responsibilities: _value rule classification_. **/
export interface ValueRulesContract {
	append_value_rules(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void;
	repeated_typeof(node: ts.TypeOfExpression): boolean;
	typed_primitive(expression: ts.Expression, source_file: ts.SourceFile): boolean;
	dynamic_class(node: ts.Node): boolean;
}

/** Responsibilities: _rest union rule classification_. **/
export interface RestUnionContractRuleContract {
	rest_parameter(node: ts.Node): boolean;
	append_rule(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _source-qualified callable symbol lookup_. **/
export interface CallableSymbolIndexContract {
	types_named(name: string, source_file: string): AstTypeMemberRecord[];
	type_members(type_name: string, source_file: string): string[];
	type_member_names(type_name: string, source_file: string): ReadonlySet<string>;
}
