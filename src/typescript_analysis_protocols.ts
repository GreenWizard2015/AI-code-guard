import type { StaticArraySourceAppenderContract, StaticExpressionArrayContract } from "src/analysis_protocols";
import type { ProxyRulesContract } from "src/analysis_protocols";
import type { StringSetMap } from "src/analysis_types";
import type {
	AstCallableNode,
	AstClassField,
	AstClassNode,
	AstResponsibilityTarget,
	CallableReferenceIdentity,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type {
	TypeScriptCallReferenceCollectorContract,
	TypeScriptReferenceQuery,
	TypeScriptReferenceResolutionContract,
} from "src/model/protocols";
import type { TypeScriptTypeDetails } from "src/model/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { DynamicRuntimeUsageContract } from "src/runtime_protocols";
import type {
	CallableSourceLineResolver,
	CallableStaticObjectBranchAppender,
	CallableStaticObjectValueAppender,
} from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData, TypeScriptTreeMetadata } from "src/source_types";
import type { CallableRuleAppender, CallbackCounts, RuleContextContract, TypeScriptPropertySide } from "src/types";
import type { CallableCallReferenceVisitor } from "src/typescript_analysis_types";
import type {
	TypeScriptAstTraversalContract,
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptTestNodeRulesContract,
} from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _module namespace import names_, _module dependency membership_. **/
export interface ModuleNamespaceImportsContract {
	names(source_file: ts.SourceFile): ReadonlySet<string>;
	dependency(candidate: ts.NewExpression): boolean;
}

/** Responsibilities: _runtime imports_, _type imports_. **/
export interface PlatformSourceImportScopeContract {
	node_api_call(call: ts.CallExpression): boolean;
	node_api_type(field: ts.PropertyDeclaration): boolean;
	adapter_member(call: ts.CallExpression, field_name: string): boolean;
}

/** Responsibilities: _platform detector dependencies_. **/
export type PlatformApiDetectorDependencies = {
	readonly module_namespace_imports: ModuleNamespaceImportsContract;
};

/** Responsibilities: _platform API calls_, _module namespace imports_. **/
export interface PlatformApiDetectionContract {
	module_namespace_imports(): ModuleNamespaceImportsContract;
	platform_call(call: ts.Node): boolean;
	platform_adapter_call(call: ts.Node): boolean;
}

/** Responsibilities: _static expression value retrieval_. **/
export type TypeScriptExpressionValueQuery = {
	readonly expression: ts.Expression;
};

/** Responsibilities: _static array expression targets_. **/
export type TypeScriptStaticArrayExpressionTarget = {
	readonly values: ts.Expression[];
};

/** Responsibilities: _object property expansion_, _property access_. **/
export interface StaticObjectPropertyExpansionContract {
	found(): boolean;
	properties(): readonly ts.ObjectLiteralElementLike[];
	append_to(target: ts.ObjectLiteralElementLike[]): void;
	merge(other: StaticObjectPropertyExpansionContract): StaticObjectPropertyExpansionContract;
}

/** Responsibilities: _expression structure_. **/
export interface TypeScriptCallExpressionInspectorContract {
	direct_value_expression(node: ts.Node): readonly ts.Expression[];
	bind_call(node: ts.Node): boolean;
	bind_target(node: ts.CallExpression): readonly ts.Expression[];
}

/** Responsibilities: _TypeScript file scanning contract_. **/
export interface TypeScriptFileScannerContract {
	prepare_source(source: LintSourceRecordData, stage_timer: LintStageTimerContract): void;
	scan_ignored(source: LintSourceRecordData, stage_timer: LintStageTimerContract): ViolationContract[];
}

/** Responsibilities: _module-level mutable collection diagnostics_. **/
export interface TypeScriptHiddenGlobalStateContract {
	append(violations: ViolationContract[], file: string): void;
}

/** Responsibilities: _class temporal coupling diagnostics_. **/
export interface TypeScriptTemporalCouplingContract {
	append_class(violations: ViolationContract[], file: string, node: ts.ClassDeclaration): void;
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
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	sequence(expression: ts.Expression): StaticExpressionArrayContract;
}

/** Responsibilities: _static object source resolution_. **/
export interface TypeScriptStaticObjectSourcesContract {
	append_properties(properties: ts.ObjectLiteralElementLike[], initializer: ts.Expression): boolean;
	append_binding(initializer: ts.Expression, append_branch: CallableStaticObjectBranchAppender): boolean;
	append_source(objects: Map<string, ts.ObjectLiteralExpression>, name: string, initializer: ts.Expression): boolean;
}

/** Responsibilities: _object assignment expression classification_. **/
export interface TypeScriptStaticObjectAssignmentClassifierContract {
	object_assign_call(expression: ts.CallExpression): boolean;
}

/** Responsibilities: _static object value resolution_. **/
export interface TypeScriptStaticObjectValuesContract {
	property_name(node: ts.Node): string;
	append_property_value(
		initializer: ts.ObjectLiteralExpression,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: CallableStaticObjectValueAppender,
	): boolean;
	append_value(name: string, current: ts.Expression): boolean;
	append_object(name: string, current: ts.Expression): boolean;
	property_value(object: ts.ObjectLiteralExpression, source_name: string): string;
}

/** Responsibilities: _static object property search_. **/
export type TypeScriptStaticObjectPropertySearchOptions = {
	readonly value_resolver: TypeScriptStaticObjectValuesContract;
	readonly objects: Map<string, ts.ObjectLiteralExpression>;
	readonly source_name: string;
	readonly seen: Set<ts.ObjectLiteralExpression>;
	readonly append_value: CallableStaticObjectValueAppender;
};

/** Responsibilities: _TypeScript declaration-prefix rule collection_. **/
export interface TypeScriptScriptDeclarationRulesContract {
	append(violations: ViolationContract[]): void;
}

/** Responsibilities: _TypeScript type-operation rule collection_. **/
export interface TypeScriptTypeOperationsContract {
	append_node_operation(node: ts.TypeNode, context: RuleContextContract): void;
}

/** Responsibilities: _TypeScript dictionary-return rule collection_. **/
export interface TypeScriptDictionaryReturnsContract {
	append(violations: ViolationContract[]): void;
}

/** Responsibilities: _TypeScript repeated-branch rule collection_. **/
export interface TypeScriptRepeatedBranchContract {
	repeated_branch(violations: ViolationContract[]): void;
}

/** Responsibilities: _TypeScript singleton rule collection_. **/
export interface TypeScriptSingletonCollectorContract {
	collect(): ViolationContract[];
}

/** Responsibilities: _TypeScript class node construction_. **/
export interface TypeScriptClassNodesContract {
	append_node(node: ts.Node, declarations: AstClassNode[]): void;
	declaration_nodes(): AstClassNode[];
}

/** Responsibilities: _class metadata node accumulation_. **/
export type TypeScriptClassMetadataCollection = {
	readonly nodes: AstClassNode[];
	readonly node_factory: TypeScriptClassNodesContract;
};

/** Responsibilities: _TypeScript AST metadata construction_. **/
export interface TypeScriptAstMetadataContract {
	normalized(classes: AstClassNode[], functions: AstCallableNode[]): NormalizedAstFile;
}

/** Responsibilities: _AST metadata dependencies_. **/
export type TypeScriptAstMetadataOptions = {
	readonly source_file: ts.SourceFile;
	readonly call_reference_collector: TypeScriptCallReferenceCollectorContract;
	readonly stage_timer: LintStageTimerContract;
	readonly traversal: TypeScriptAstTraversalContract;
	readonly declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	readonly class_nodes: TypeScriptClassNodesContract;
};

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
	unwrapped_expression(expression: ts.Expression): ts.Expression;
	unwrap_expression(expression: ts.Expression): ts.Expression[];
}

/** Responsibilities: _instance construction_, _reference type resolution_. **/
export interface TypeScriptReferenceBindingContract {
	new_expression_owner(expression: ts.NewExpression): string;
	resolved_reference_name(type: ts.TypeNode): string;
	new_instance(node: ts.VariableDeclaration, initializer: ts.Expression): boolean;
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
	collect_bindings(): void;
}

/** Responsibilities: _member variable aliases_. **/
export type TypeScriptMemberAliasTarget = {
	readonly aliases: StringSetMap;
	readonly name: string;
};

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

/** Responsibilities: _assignment value classification_. **/
export interface TypeScriptAssignmentValuePredicatesContract {
	operand_allowed(left: ts.Expression, right: ts.Expression, source_file: ts.SourceFile): boolean;
	primitive_expression(expression: ts.Expression): boolean;
	enum_member_default(expression: ts.Expression): boolean;
}

/** Responsibilities: _assignment context classification_. **/
export interface TypeScriptAssignmentContextContract {
	conditional_assignment(node: ts.Node): boolean;
	logical_assignment(node: ts.Node): boolean;
}

/** Responsibilities: _concrete collaborator creation diagnostics_. **/
export interface TypeScriptConcreteCollaboratorCreationContract {
	append(): void;
}

/** Responsibilities: _conditional rule aggregation_, _conditional expression source context_. **/
export type TypeScriptConditionalSource = {
	readonly node: ts.Node;
	readonly source_file: ts.SourceFile;
};

/** Responsibilities: _conditional rule operations_. **/
export interface TypeScriptConditionalRulesContract {
	append(node: ts.Node, source_file: ts.SourceFile, append_rule: CallableRuleAppender): void;
}

/** Responsibilities: _nested expression containment_. **/
export interface TypeScriptExpressionContainersContract {
	nested(node: ts.Node): boolean;
	contains(parent: ts.Node, child: ts.Node): boolean;
}

/** Responsibilities: _conditional parent lookup_. **/
export interface TypeScriptConditionalParentIndexContract {
	conditional_parent(node: ts.BinaryExpression): boolean;
	statement_condition_parent(container: ts.Node, child: ts.Node): boolean;
}

/** Responsibilities: _terminal branch classification_. **/
export interface TypeScriptTerminalBranchesContract {
	terminal_statement(statement: ts.Statement): boolean;
	early_exit(node: ts.IfStatement): boolean;
}

/** Responsibilities: _union boundary rule aggregation_. **/
export interface TypeScriptBoundaryRuleAppenderContract {
	append(node: ts.Node, context: RuleContextContract): void;
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

/** Responsibilities: _runtime node rule access_. **/
export type TypeScriptNodeRuntimeRulesData = {
	readonly platform_api: PlatformApiDetectionContract;
	readonly this_aliases: TypeScriptExpressionAliasesContract;
	readonly call_expression_inspector: TypeScriptCallExpressionInspectorContract;
	readonly test_node_rules: TypeScriptTestNodeRulesContract;
	readonly dynamic_runtime_usage: DynamicRuntimeUsageContract;
	readonly proxy_rules: ProxyRulesContract;
};

/** Responsibilities: _TypeScript reference ownership resolution_. **/
export interface TypeScriptReferenceOwnershipContract {
	resolve_reference(query: TypeScriptReferenceQuery): TypeScriptReferenceResolutionContract;
	function_reference(expression: ts.Identifier): CallableReferenceIdentity;
}

/** Responsibilities: _boolean declaration index_. **/
export interface TypeScriptBooleanDeclarationIndexContract {
	boolean_properties(): ReadonlySet<string>;
	boolean_callables(): ReadonlySet<string>;
	append(source_file: ts.SourceFile): void;
}

/** Responsibilities: _overload sibling name indexing_. **/
export interface TypeScriptOverloadSiblingNamesContract {
	append(node: ts.Node): void;
	counts(name: string): TypeScriptOverloadSiblingCounts;
}

/** Responsibilities: _TypeScript class field usage_. **/
export interface TypeScriptClassFieldAnalysisContract {
	collect(): TypeScriptClassFieldReadIndex;
}

/** Responsibilities: _class field read indexes_. **/
export type TypeScriptClassFieldReadIndex = {
	readonly used_fields: ReadonlySet<string>;
	readonly decision_fields: ReadonlySet<string>;
	readonly error_context_fields: ReadonlySet<string>;
};

/** Responsibilities: _class decision field collection_. **/
export interface TypeScriptClassDecisionFieldsContract {
	collect(): TypeScriptClassDecisionFieldIndex;
}

/** Responsibilities: _class decision field index_. **/
export type TypeScriptClassDecisionFieldIndex = {
	readonly decision_fields: ReadonlySet<string>;
	readonly error_context_fields: ReadonlySet<string>;
};

export type CallableTypeScriptAstNodeAction = (node: ts.Node) => void;

/** Responsibilities: _TypeScript class field classification_. **/
export interface TypeScriptClassFieldClassifierContract {
	field(name: string): TypeScriptClassFieldClassification;
	delegates_collection(): boolean;
}

export type TypeScriptClassFieldClassification = {
	readonly data: boolean;
	readonly scalar: boolean;
	readonly collection: boolean;
	readonly is_public: boolean;
};

/** Responsibilities: _TypeScript constructor assignment analysis_. **/
export interface TypeScriptConstructorAssignmentsContract {
	retains_dependency(): boolean;
	retains_value_invariant(): boolean;
}

/** Responsibilities: _TypeScript constructor parameter classification_. **/
export interface TypeScriptConstructorParametersContract {
	parameter_names(): Set<string>;
	uses_parameter(expression: ts.Expression, names: ReadonlySet<string>): boolean;
	property_modifier(parameter: ts.ParameterDeclaration): boolean;
}

export type TypeScriptOverloadSiblingCounts = {
	function_declarations: number;
	implemented_methods: number;
	interface_methods: number;
};

/** Responsibilities: _TypeScript tree metadata collection_. **/
export interface TypeScriptTreeMetadataCollectorContract {
	collect(
		line_for: CallableSourceLineResolver,
		on_reference: CallableCallReferenceVisitor,
		class_metadata: TypeScriptClassMetadataCollection,
		stage_timer: LintStageTimerContract,
	): TypeScriptTreeMetadata;
}

/** Responsibilities: _prototype alias scope resolution_. **/
export interface RuntimeAliasScopeContract {
	lexical_scope(node: ts.Node): ts.Node;
	contains(scope: ts.Node, node: ts.Node): boolean;
	conditional_write(node: ts.Node, scope: ts.Node): boolean;
	visible(declaration: ts.VariableDeclaration, mutation: ts.Node): boolean;
}
