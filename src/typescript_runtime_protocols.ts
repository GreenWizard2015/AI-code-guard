import type { CallableObjectSourceVisitor } from "src/analysis_types";
import type {
	AstReferenceAlias,
	CallableReferenceIdentity,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { TypeScriptReferenceQuery, TypeScriptReferenceResolutionContract } from "src/model/protocols";
import type { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableSpreadValueAppender } from "src/runtime_types";
import type { Assignment, CallableRuleAppender, RuleContextContract } from "src/types";
import type {
	CallableTypeScriptAstTraversalVisitor,
	CallableTypeScriptFunctionOwnerVisitor,
	CallableTypeScriptPrunedNodeVisitor,
} from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _lexical binding scope lookup_. **/
export interface LexicalBindingScopeContract {
	type_name_shadowed(type_reference: ts.Node, name: string): boolean;
	value_name_shadowed(value_reference: ts.Node, name: string): boolean;
}

/** Responsibilities: _lexical declaration lookup_. **/
export type LexicalDeclarationNameQuery = {
	readonly node: ts.Node;
	readonly name: string;
};

/** Responsibilities: _lexical scope lookup_. **/
export type LexicalScopedNameQuery = {
	readonly scope: ts.Node;
	readonly name: string;
	readonly type_name: boolean;
};

/** Responsibilities: _shadowed name lookup_. **/
export type LexicalShadowedNameQuery = {
	readonly node: ts.Node;
	readonly name: string;
	readonly type_name: boolean;
};

/** Responsibilities: _TypeScript test-node rules contract_. **/
export interface TypeScriptTestNodeRulesContract {
	test_node(node: ts.Node): boolean;
	append_rules(node: ts.Node, context: RuleContextContract): void;
}

/** Responsibilities: _console receiver alias resolution_. **/
export interface TypeScriptConsoleAliasResolverContract {
	member_name(member_expression: ts.Expression, lookup_site: ts.Node): string;
	console_expression(receiver_expression: ts.Expression, lookup_source: ts.Node): boolean;
}

/** Responsibilities: _single-item callable declaration analysis_. **/
export interface TypeScriptArrayCallableDeclarationsContract {
	collect_index(indexed_file: ts.SourceFile): ReadonlyMap<string, readonly ts.FunctionLikeDeclaration[]>;
	single_item_callable(callable: ts.FunctionLikeDeclaration): boolean;
}

/** Responsibilities: _TypeScript structural rules contract_. **/
export interface TypeScriptStructuralRulesContract {
	append(node: ts.Node, context: RuleContextContract): void;
}

/** Responsibilities: _type-shape rule application_, _source alias collection_. **/
export interface TypeScriptTypeShapeRulesContract {
	append_type_rules(node: ts.Node, context: RuleContextContract): void;
}

/** Responsibilities: _TypeScript declaration indexing_. **/
export interface TypeScriptDeclarationIndexContract {
	modifier_present(statement: ts.Statement, kind: ts.SyntaxKind): boolean;
	declarations_for(source_file: ts.SourceFile, name: string): readonly ts.Statement[];
	default_declarations(source_file: ts.SourceFile): readonly ts.Statement[];
	export_assignments(source_file: ts.SourceFile): readonly ts.ExportAssignment[];
	symbol_kind(source_file: ts.SourceFile, name: string): ResolvedTypeScriptDeclarationKind;
}

/** Responsibilities: _typed object callable aliases_. **/
export interface TypeScriptObjectCallableAliasesContract {
	contains(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _typed callable binding contract_. **/
export interface TypeScriptTypedCallableBindingsContract {
	declaration(node: ts.Node): void;
	variable(node: ts.VariableDeclaration): void;
}

/** Responsibilities: _named member alias query_. **/
export type TypeScriptNamedMemberAliasQuery = {
	readonly expression: ts.Expression;
	readonly node: ts.Node;
	readonly name: string;
};

/** Responsibilities: _TypeScript member alias resolution_. **/
export interface TypeScriptMemberAliasesContract {
	member(query: TypeScriptExpressionReceiverQuery): boolean;
	property(query: TypeScriptNamedMemberAliasQuery): boolean;
}

/** Responsibilities: _callable alias name resolution_. **/
export interface TypeScriptCallableAliasesContract {
	names(node: ts.Node): ReadonlySet<string>;
	contains(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _static array key contract_. **/
export interface TypeScriptStaticArrayKeysContract {
	value(expression: ts.Expression, source_file: ts.SourceFile): string;
	expressions(expression: ts.Expression, source_file: ts.SourceFile): readonly ts.Expression[];
}

/** Responsibilities: _static key alias contract_. **/
export interface TypeScriptStaticKeyAliasesContract {
	value(expression: ts.Expression, node: ts.Node): string;
	object_property(expression: ts.Expression, node: ts.Node): string;
}

/** Responsibilities: _static object binding contract_. **/
export interface TypeScriptStaticObjectBindingsContract {
	append(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		node: ts.VariableDeclaration,
	): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
}

/** Responsibilities: _callable type property contract_. **/
export interface TypeScriptCallableTypePropertiesContract {
	property_name(name: ts.PropertyName): string;
	object_properties(type: ts.TypeLiteralNode): Set<string>;
	interface_properties(node: ts.InterfaceDeclaration): Set<string>;
	class_properties(node: ts.ClassDeclaration): Set<string>;
}

/** Responsibilities: _assignment analysis contract_. **/
export interface TypeScriptAssignmentAnalysisContract {
	binding_name(name: ts.BindingName): string;
	returned_names_from(statement: ts.Statement): string[];
	assignment_value(statement: ts.Statement, source_file: ts.SourceFile): Assignment[];
	pointless_assignment(candidates: Assignment[], returned_name: string): boolean;
}

/** Responsibilities: _TypeScript reexport collection contract_. **/
export interface TypeScriptReexportsContract {
	append(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _TypeScript alias resolution_. **/
export interface TypeScriptBoundaryAliasesContract {
	collect(source_file: ts.SourceFile, existing: readonly AstReferenceAlias[]): AstReferenceAlias[];
}

/** Responsibilities: _TypeScript reference context_. **/
export interface TypeScriptReferenceContextContract {
	function_reference(expression: ts.Identifier): CallableReferenceIdentity;
	resolve_reference(query: TypeScriptReferenceQuery): TypeScriptReferenceResolutionContract;
}

/** Responsibilities: _AST traversal access_. **/
export interface TypeScriptAstTraversalContract {
	visit(visitor: CallableTypeScriptAstTraversalVisitor): void;
	visit_descendants(visitor: CallableTypeScriptAstTraversalVisitor): void;
	visit_registered_nodes(
		root_node: ts.Node,
		visitor: CallableTypeScriptPrunedNodeVisitor,
		registered_kinds: ArrayLike<number>,
	): void;
	/** Responsibilities: _phase-scoped observer delivery_. **/
	dispatch_registered_nodes(
		root_node: ts.Node,
		node_visitor: CallableTypeScriptAstTraversalVisitor,
		registered_node_kinds: ArrayLike<number>,
	): void;
	visit_function_owners(visitor: CallableTypeScriptFunctionOwnerVisitor): void;
}

/** Responsibilities: _AST file access_, _AST normalization_, _traversal reuse_. **/
export interface TypeScriptAstFileContract {
	source_file_node(): ts.SourceFile;
	normalized(): NormalizedAstFile;
	reference_normalization(cached: NormalizedAstFile): NormalizedAstFile;
}

/** Responsibilities: _TypeScript expression alias operations_. **/
export interface TypeScriptExpressionAliasesContract {
	append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean;
	unwrapped(expression: ts.Expression): ts.Expression;
	receiver(query: TypeScriptExpressionReceiverQuery): boolean;
	member_name(query: TypeScriptExpressionQuery): string;
}

/** Responsibilities: _expression query_. **/
export type TypeScriptExpressionQuery = {
	readonly expression: ts.Expression;
};

/** Responsibilities: _expression receiver query_. **/
export type TypeScriptExpressionReceiverQuery = {
	readonly expression: ts.Expression;
	readonly node: ts.Node;
};

/** Responsibilities: _TypeScript type alias resolution_. **/
export interface TypeScriptTypeAliasesContract {
	collect(source_file: ts.SourceFile): void;
	resolve(name: string): string;
}

/** Responsibilities: _static object arguments contract_. **/
export interface TypeScriptStaticObjectArgumentsContract {
	append_assignment(node: ts.BinaryExpression): boolean;
	append_spread(element: ts.SpreadElement, append_value: CallableSpreadValueAppender): boolean;
}

/** Responsibilities: _TypeScript object property collection_. **/
export interface TypeScriptObjectPropertyCollectorContract {
	appended(node: ts.VariableDeclaration, initializer: ts.Expression): boolean;
}

/** Responsibilities: _TypeScript object alias operations_. **/
export interface TypeScriptObjectAliasesContract {
	collect(scope: ts.Node): void;
	value(expression: ts.Expression): ts.Expression;
	property_values(expression: ts.Expression, property_name: string): readonly ts.Expression[];
}

/** Responsibilities: _object property value search_. **/
export type TypeScriptObjectPropertyValueSearchOptions = {
	readonly aliases: TypeScriptObjectAliasesContract;
	readonly expression_names: ExpressionNamesContract;
	readonly property_name: string;
};

/** Responsibilities: _object alias declaration application_. **/
export type CallableTypeScriptObjectAliasDeclarationAppender = (declaration: ts.Node) => boolean;

/** Responsibilities: _AST declaration scope queries_, _variable declaration collection_. **/
export interface TypeScriptVariableDeclarationScopeContract {
	all_variable_declarations(): readonly ts.VariableDeclaration[];
	member_variable_declarations(): readonly ts.VariableDeclaration[];
}

/** Responsibilities: _AST-scoped object alias declarations_. **/
export interface TypeScriptObjectAliasDeclarationIndexContract {
	declarations(scope: ts.Node): readonly ts.Node[];
	variable_scope(ast_scope: ts.Node): TypeScriptVariableDeclarationScopeContract;
	append(scope: ts.Node, append_declaration: CallableTypeScriptObjectAliasDeclarationAppender): boolean;
	normalize_expression(expression: ts.Expression, normalizer: TypeScriptExpressionNormalizerContract): ts.Expression;
}

/** Responsibilities: _uncached expression normalization_. **/
export interface TypeScriptExpressionNormalizerContract {
	normalize_uncached(expression: ts.Expression): ts.Expression;
}

/** Responsibilities: _factory array alias operations_. **/
export interface TypeScriptFactoryArrayAliasesContract {
	names(): ReadonlySet<string>;
	alias(name: string): TypeScriptFactoryArrayAliasContract;
}

/** Responsibilities: _factory array alias resolution_. **/
export interface TypeScriptFactoryArrayAliasContract {
	expressions(declaration: ts.VariableDeclaration): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(declaration: ts.VariableDeclaration): string;
}

/** Responsibilities: _factory object property operations_. **/
export interface TypeScriptFactoryObjectPropertiesContract {
	property_key(property: ts.ObjectLiteralElementLike): string;
	property_context(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): TypeScriptFactoryObjectPropertyLookupContract;
	binding_expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
}

/** Responsibilities: _object property lookup_. **/
export interface TypeScriptFactoryObjectPropertyLookupContract {
	expressions(): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(): string;
}

/** Responsibilities: _namespace alias resolution_. **/
export interface TypeScriptNamespaceAliasesContract {
	names(): ReadonlySet<string>;
	target(initializer: ts.Expression): string;
}

/** Responsibilities: _type name lookup_. **/
export interface TypeScriptTypeNameLookupContract {
	contains(name: string): boolean;
}

/** Responsibilities: _class alias resolution_. **/
export interface TypeScriptClassAliasesContract {
	names(): ReadonlySet<string>;
	name(name: string): boolean;
	access(expression: ts.Expression): boolean;
}

/** Responsibilities: _factory object alias collection_. **/
export interface TypeScriptFactoryObjectAliasesContract {
	append_expression(
		declaration: ts.VariableDeclaration,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void;
	names(): ReadonlySet<string>;
	source(declaration: ts.VariableDeclaration, name: string): string;
	property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[];
}

/** Responsibilities: _factory alias aggregation_. **/
export interface TypeScriptFactoryAliasesContract {
	names(): ReadonlySet<string>;
	sources(name: string): readonly string[];
	inline_bodies(name: string): readonly ts.FunctionLikeDeclarationBase[];
	property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[];
}

/** Responsibilities: _singleton expression detection_. **/
export interface TypeScriptSingletonExpressionsContract {
	initializer(expression: ts.Expression): boolean;
	variable(declaration: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _block instance collection_. **/
export interface TypeScriptBlockInstanceCaptureContract {
	module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[];
	module_variable_names(declarations: readonly ts.VariableDeclaration[]): ReadonlySet<string>;
	escaped_variables(block: ts.Block, names: ReadonlySet<string>): ts.VariableDeclaration[];
}

/** Responsibilities: _TypeScript basic rule collection_. **/
export interface TypeScriptBasicRulesContract {
	append_parameter_rules(node: ts.Node, append_rule: CallableRuleAppender): void;
	append_alias_rules(node: ts.Node, append_rule: CallableRuleAppender): void;
}

/** Responsibilities: _TypeScript expression rule collection_. **/
export interface TypeScriptExpressionRuleContract {
	append(node: ts.Node, append_rule: CallableRuleAppender): void;
}

/** Responsibilities: _TypeScript factory object sources_. **/
export interface TypeScriptFactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(expression: ts.Expression, visitor: CallableObjectSourceVisitor): void;
}
