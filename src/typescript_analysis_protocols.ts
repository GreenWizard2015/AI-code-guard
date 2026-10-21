import type { TypeScriptTypeDetails } from "src/model/types";
import type { LintFileNameContract, LintSourceRecord, TypeScriptTreeMetadata } from "src/source_types";
import type {
	TypeScriptPropertySide,
	AstCallableNodeContract,
	AstClassField,
	AstClassNodeContract,
	AstResponsibilityTarget,
	CallableReferenceIdentity,
	CallbackCounts,
	NormalizedAstFileContract,
	RuleAppender,
	RuleContextData,
	TypeScriptAssignmentContext,
} from "src/types";
import type ts from "typescript";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract, TypeScriptObjectAliasesContract } from "src/typescript_runtime_protocols";
import type { LintStageTimerContract, LintProjectContextContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { StaticExpressionArrayContract, StaticArraySourceAppenderContract, StaticArrayExpressionOwnerContract } from "src/analysis_protocols";
import type { StaticObjectBranchAppender, StaticObjectValueAppender, SourceLineResolver } from "src/runtime_types";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type { TypeScriptScriptRuleOptions, TypeScriptMetadataNodeVisitor } from "src/typescript_analysis_types";
import type { StringSetMap } from "src/analysis_types";

/** Responsibilities: _expression structure_. **/
export interface TypeScriptCallExpressionInspectorContract {
	direct_value_expression(node: ts.Node): readonly ts.Expression[];
	bind_target(node: ts.CallExpression): readonly ts.Node[];
}

/** Responsibilities: _TypeScript file scanning contract_. **/
export interface TypeScriptFileScannerContract {
	scan(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFileContract,
		traversal: TypeScriptAstTraversalContract,
		stage_timer: LintStageTimerContract,
	): ViolationContract[];
	scan_ignored(source: LintSourceRecord, stage_timer: LintStageTimerContract): ViolationContract[];
}

/** Responsibilities: _class field normalization_. **/
export interface TypeScriptClassMembersContract {
	callback_counts(node: ts.ClassLikeDeclaration): CallbackCounts;
	class_fields(node: ts.ClassLikeDeclaration): AstClassField[];
	interface_fields(node: ts.InterfaceDeclaration): AstClassField[];
	type_alias_fields(node: ts.TypeAliasDeclaration): AstClassField[];
}

/** Responsibilities: _static array index resolution_. **/
export interface TypeScriptStaticArrayIndexValuesContract {
	numeric_index(expression: ts.Expression): number;
	append(
		values: ts.Expression[],
		expression: ts.ElementAccessExpression,
		source: StaticExpressionArrayContract,
		append_source: StaticArraySourceAppenderContract,
	): boolean;
}

/** Responsibilities: _static array value resolution_. **/
export interface TypeScriptStaticArrayValuesContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	values(expression: ts.Expression): readonly ts.Expression[];
	sequence(expression: ts.Expression): StaticExpressionArrayContract;
}

/** Responsibilities: _structural array value expansion_, _composed expression sequences_. **/
export interface TypeScriptStaticArrayStructureContract {
	append(values: ts.Expression[], expression: ts.Expression, owner: StaticArrayExpressionOwnerContract): boolean;
	sequence(expression: ts.Expression, owner: StaticArrayExpressionOwnerContract): StaticExpressionArrayContract;
}

/** Responsibilities: _static object source resolution_. **/
export interface TypeScriptStaticObjectSourcesContract {
	append_properties(properties: ts.ObjectLiteralElementLike[], initializer: ts.Expression): boolean;
	append_binding(initializer: ts.Expression, append_branch: StaticObjectBranchAppender): boolean;
	append_source(objects: Map<string, ts.ObjectLiteralExpression>, name: string, initializer: ts.Expression): boolean;
}

/** Responsibilities: _static object value resolution_. **/
export interface TypeScriptStaticObjectValuesContract {
	property_name(node: ts.Node): string;
	append_property_value(
		initializer: ts.ObjectLiteralExpression,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: StaticObjectValueAppender,
	): boolean;
	append_value(name: string, current: ts.Expression): boolean;
	append_object(name: string, current: ts.Expression): boolean;
	property_value(object: ts.ObjectLiteralExpression, source_name: string): string;
}

/** Responsibilities: _TypeScript declaration-prefix rule collection_. **/
export interface TypeScriptScriptDeclarationRulesContract {
	append_indexed_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		declaration_candidates: readonly ts.Node[],
	): void;
}

/** Responsibilities: _TypeScript inline-type rule collection_. **/
export interface TypeScriptInlineRulesContract {
	node_violations(file: string, source_file: ts.SourceFile, node: ts.Node): ViolationContract[];
	append_node(violations: ViolationContract[], file: string, source_file: ts.SourceFile, node: ts.Node): void;
}

/** Responsibilities: _TypeScript type-operation rule collection_. **/
export interface TypeScriptTypeOperationsContract {
	append_node_operation(violations: ViolationContract[], file: string, source_file: ts.SourceFile, node: ts.Node): void;
}

/** Responsibilities: _TypeScript dictionary-return rule collection_. **/
export interface TypeScriptDictionaryReturnsContract {
	dictionary_return_info(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void;
}

/** Responsibilities: _TypeScript repeated-branch rule collection_. **/
export interface TypeScriptRepeatedBranchContract {
	repeated_branch(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _shared TypeScript script-rule services_. **/
export interface TypeScriptScriptRuleServicesContract {
	append_rules(options: TypeScriptScriptRuleOptions): void;
}

/** Responsibilities: _TypeScript singleton rule collection_. **/
export interface TypeScriptSingletonCollectorContract {
	collect(): ViolationContract[];
}

/** Responsibilities: _TypeScript class node construction_. **/
export interface TypeScriptClassNodesContract {
	class_nodes(): AstClassNodeContract[];
	interface_nodes(): AstClassNodeContract[];
}

/** Responsibilities: _TypeScript AST metadata construction_. **/
export interface TypeScriptAstMetadataContract {
	normalized(classes: AstClassNodeContract[], functions: AstCallableNodeContract[]): NormalizedAstFileContract;
}

/** Responsibilities: _TypeScript responsibility targets_. **/
export interface TypeScriptResponsibilityTargetsContract {
	collect(): AstResponsibilityTarget[];
}

/** Responsibilities: _object destructured aliases_. **/
export interface TypeScriptDestructuredAliasesContract {
	register_sources(declarations: readonly ts.VariableDeclaration[]): void;
	object_aliases(declaration: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _array destructured aliases_. **/
export interface TypeScriptArrayDestructuredAliasesContract {
	register_sources(declarations: readonly ts.VariableDeclaration[]): void;
	array_aliases(declaration: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _result ownership_. **/
export interface TypeScriptCallReturnAnalysisContract {
	reference_owner(type: ts.TypeNode): string;
}

/** Responsibilities: _result values_. **/
export interface TypeScriptCallReturnsContract {
	initialize(): void;
	owner_for(name: string, owner: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _TypeScript callable reference identity_. **/
export interface TypeScriptReferenceIdentityContract {
	member_name(expression: ts.AccessExpression): string;
	method_reference(expression: ts.AccessExpression, owner: string): CallableReferenceIdentity;
}

/** Responsibilities: _TypeScript instance alias collection_. **/
export interface TypeScriptInstanceAliasCollectorContract {
	collect_variables(): void;
	collect_parameters(): void;
	collect_bindings(): void;
}

/** Responsibilities: _member variable aliases_. **/
export interface TypeScriptMemberVariableAliasesContract {
	append_member(aliases: StringSetMap, node: ts.VariableDeclaration): boolean;
	append(aliases: StringSetMap, node: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _static array values_. **/
export interface TypeScriptStaticArrayValuesContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	values(expression: ts.Expression): readonly ts.Expression[];
	sequence(expression: ts.Expression): StaticExpressionArrayContract;
}

/** Responsibilities: _TypeScript node type rules_. **/
export interface TypeScriptNodeTypeRulesContract {
	append_type_rules(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript class-node rule collection_. **/
export interface TypeScriptClassNodeRulesContract {
	append(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _assignment predicate classification_. **/
export interface TypeScriptAssignmentPredicatesContract {
	field_assignment(node: ts.Node, context: TypeScriptAssignmentContext): boolean;
	primitive_assignment(node: ts.ConditionalExpression): boolean;
}

/** Responsibilities: _assignment value classification_. **/
export interface TypeScriptAssignmentValuePredicatesContract {
	operand_allowed(left: ts.Expression, right: ts.Expression, source_file: ts.SourceFile): boolean;
	conditional_assignment(node: ts.Node): boolean;
	logical_assignment(node: ts.Node): boolean;
	primitive_expression(expression: ts.Expression): boolean;
	enum_member_default(expression: ts.Expression): boolean;
}

/** Responsibilities: _array state rule classification_. **/
export interface TypeScriptArrayStateRulesContract {
	array_access(node: ts.Node, source_file: ts.SourceFile): boolean;
	append(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _conditional rule aggregation_. **/
export interface TypeScriptConditionalRulesContract {
	append(node: ts.Node, source_file: ts.SourceFile, append_rule: RuleAppender): void;
	append_if_block(node: ts.Node, append_rule: RuleAppender): void;
}

/** Responsibilities: _terminal branch classification_. **/
export interface TypeScriptTerminalBranchesContract {
	terminal_statement(statement: ts.Statement): boolean;
	early_exit(node: ts.IfStatement): boolean;
}

/** Responsibilities: _union boundary rule aggregation_. **/
export interface TypeScriptBoundaryRuleAppenderContract {
	append(node: ts.Node, context: RuleContextData): void;
	union_rules_apply(node: ts.Node): boolean;
}

/** Responsibilities: _TypeScript boolean precedence classification_. **/
export interface TypeScriptOperatorPrecedenceContract {
	mixed_boolean_operator(node: ts.Node): boolean;
}

/** Responsibilities: _proxy expression resolution_. **/
export interface TypeScriptProxyExpressionsContract {
	property_chain(node: ts.Node): string[];
	contains_property(node: ts.Node, property: string): boolean;
}

/** Responsibilities: _imported callable owners_. **/
export interface TypeScriptImportedCallOwnersContract {
	collect(): ReadonlyMap<string, string>;
	append_to(owners: Map<string, string>): void;
}

/** Responsibilities: _TypeScript class-field rule collection_. **/
export interface TypeScriptClassFieldRulesContract {
	missing_visibility(node: ts.Node, file: string): boolean;
	mutable_field(node: ts.Node, file: string): boolean;
	collect_fields(files: string[], repo_root: string): ViolationContract[];
	context_fields(files: string[], repo_root: string, context: LintProjectContextContract): ViolationContract[];
}

/** Responsibilities: _TypeScript type-node classification_. **/
export interface TypeScriptTypeNodeContract {
	primitive(): boolean;
	details(): TypeScriptTypeDetails;
}

/** Responsibilities: _TypeScript variable declaration lookup_. **/
export interface TypeScriptVariableDeclarationIndexContract {
	declarations(source_file: ts.SourceFile, name: string): readonly ts.VariableDeclaration[];
	declarations_present(source_file: ts.SourceFile, name: string): boolean;
}

/** Responsibilities: _TypeScript node rule collection_. **/
export interface TypeScriptNodeRulesContract {
	append_node_rules(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
	append_mutable_rule(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript expression alias collection_. **/
export interface TypeScriptExpressionAliasCollectorContract {
	append_scope_aliases(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean;
	collect(scope: ts.Node): ReadonlySet<string>;
}

/** Responsibilities: _TypeScript member binding collection_. **/
export interface TypeScriptMemberBindingContract {
	member_name(expression: ts.Expression, source: ts.Node): string;
	collect(scope: ts.Node): StringSetMap;
}

/** Responsibilities: _static array sources_. **/
export interface TypeScriptStaticArraySourcesContract {
	append_source(node: ts.VariableDeclaration): boolean;
	append_assignment(name: string, expression: ts.Expression): boolean;
	append_rest(name: string, values: StaticExpressionArrayContract): boolean;
}

/** Responsibilities: _static array bindings_. **/
export interface TypeScriptStaticArrayExpressionBindingsContract {
	append_binding(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
	append(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _static expression bindings_. **/
export interface TypeScriptStaticExpressionBindingsContract {
	append_source(node: ts.VariableDeclaration): boolean;
	append(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
}

/** Responsibilities: _TypeScript reference ownership resolution_. **/
export interface TypeScriptReferenceOwnershipContract {
	call_owner(expression: ts.Expression, current_owner: string): string;
	property_owner(expression: ts.PropertyAccessExpression, current_owner: string): string;
	function_reference(expression: ts.Identifier): CallableReferenceIdentity;
	method_reference(expression: ts.AccessExpression, current_owner: string): CallableReferenceIdentity;
	method_owner(expression: ts.AccessExpression, current_owner: string): string;
}

/** Responsibilities: _boolean declaration lookup_. **/
export interface TypeScriptBooleanDeclarationIndexContract {
	readonly boolean_properties: ReadonlySet<string>;
	readonly boolean_callables: ReadonlySet<string>;
	append(source_file: ts.SourceFile): void;
}

/** Responsibilities: _overload sibling name indexing_. **/
export interface TypeScriptOverloadSiblingNamesContract {
	append(node: ts.Node): void;
	function_declaration_count(name: string): number;
	implemented_method_count(name: string): number;
	interface_method_count(name: string): number;
}

/** Responsibilities: _TypeScript tree metadata collection_. **/
export interface TypeScriptTreeMetadataCollectorContract {
	collect(line_for: SourceLineResolver, on_node: TypeScriptMetadataNodeVisitor): TypeScriptTreeMetadata;
}

/** Responsibilities: _prototype alias scope resolution_. **/
export interface RuntimeAliasScopeContract {
	lexical_scope(node: ts.Node): ts.Node;
	contains(scope: ts.Node, node: ts.Node): boolean;
	conditional_write(node: ts.Node, scope: ts.Node): boolean;
	visible(declaration: ts.VariableDeclaration, mutation: ts.Node): boolean;
}
