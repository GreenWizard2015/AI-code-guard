import type { ObjectSourceVisitor, StringSetMap } from "src/analysis_types";
import type { StaticKeyCollectionState } from "src/model/types/types";
import type { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { SpreadValueAppender } from "src/runtime_types";
import type {
	Assignment,
	AstReferenceAlias,
	CallableReferenceIdentity,
	NormalizedAstFileContract,
	RuleAppender,
	RuleContextData,
} from "src/types";
import type {
	TypeScriptAstNodeCollection,
	TypeScriptAstTraversalVisitor,
	TypeScriptFunctionOwnerVisitor,
} from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _lexical binding scope lookup_. **/
export interface LexicalBindingScopeContract {
	type_name_shadowed(node: ts.Node, name: string): boolean;
	value_name_shadowed(node: ts.Node, name: string): boolean;
}

/** Responsibilities: _TypeScript test-node rules contract_. **/
export interface TypeScriptTestNodeRulesContract {
	test_node(node: ts.Node): boolean;
	append_rules(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript structural rules contract_. **/
export interface TypeScriptStructuralRulesContract {
	append(node: ts.Node, context: RuleContextData): void;
	append_type_rules(node: ts.Node, context: RuleContextData): void;
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

/** Responsibilities: _typed callable bindings_. **/
export interface TypeScriptContractBindingsContract {
	append(interfaces: StringSetMap, node: ts.Node): boolean;
}

/** Responsibilities: _typed callable binding contract_. **/
export interface TypeScriptTypedCallableBindingsContract {
	interface_declaration(node: ts.InterfaceDeclaration): void;
	type_alias_declaration(node: ts.TypeAliasDeclaration): void;
	class_declaration(node: ts.ClassDeclaration): void;
	variable(objects: StringSetMap, interfaces: StringSetMap, node: ts.VariableDeclaration): void;
}

/** Responsibilities: _TypeScript member alias resolution_. **/
export interface TypeScriptMemberAliasesContract {
	member(expression: ts.Expression, node: ts.Node): boolean;
	property(expression: ts.Expression, node: ts.Node, name: string): boolean;
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

/** Responsibilities: _static key state contract_. **/
export interface TypeScriptStaticKeyStateContract {
	collect(scope: ts.Node): StaticKeyCollectionState;
	values(scope: ts.Node): ReadonlyMap<string, string>;
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
	method_reference(expression: ts.AccessExpression, current_owner: string): CallableReferenceIdentity;
	method_owner(expression: ts.AccessExpression, current_owner: string): string;
}

/** Responsibilities: _AST traversal access_. **/
export interface TypeScriptAstTraversalContract {
	visit(visitor: TypeScriptAstTraversalVisitor): void;
	visit_children(visitor: TypeScriptAstTraversalVisitor): void;
	visit_function_owners(visitor: TypeScriptFunctionOwnerVisitor): void;
}

/** Responsibilities: _AST file access_, _normalization_, _traversal reuse_. **/
export interface TypeScriptAstFileContract {
	source_file_node(): ts.SourceFile;
	normalized(): NormalizedAstFileContract;
	reference_normalization(cached: NormalizedAstFileContract): NormalizedAstFileContract;
}

/** Responsibilities: _TypeScript rule-tree traversal_, _constructor state propagation_. **/
export interface TypeScriptRuleTreeTraversalContract {
	append_root_children(context: RuleContextData): void;
	append_nested_children(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript AST node index_. **/
export interface TypeScriptAstNodeIndexContract {
	collect(): TypeScriptAstNodeCollection;
}

/** Responsibilities: _TypeScript expression alias operations_. **/
export interface TypeScriptExpressionAliasesContract {
	append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean;
	unwrapped(expression: ts.Expression): ts.Expression;
	receiver(expression: ts.Expression, node: ts.Node): boolean;
	member_name(expression: ts.Expression): string;
}

/** Responsibilities: _TypeScript type alias resolution_. **/
export interface TypeScriptTypeAliasesContract {
	collect(source_file: ts.SourceFile): void;
	resolve(name: string): string;
}

/** Responsibilities: _static object arguments contract_. **/
export interface TypeScriptStaticObjectArgumentsContract {
	append_declaration(node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
	append_spread(element: ts.SpreadElement, append_value: SpreadValueAppender): boolean;
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

/** Responsibilities: _object alias declaration application_. **/
export type TypeScriptObjectAliasDeclarationAppender = (declaration: ts.Node) => boolean;

/** Responsibilities: _AST-scoped object alias declarations_. **/
export interface TypeScriptObjectAliasDeclarationIndexContract {
	declarations(scope: ts.Node): readonly ts.Node[];
	append(scope: ts.Node, append_declaration: TypeScriptObjectAliasDeclarationAppender): boolean;
}

/** Responsibilities: _factory array alias operations_. **/
export interface TypeScriptFactoryArrayAliasesContract {
	names(): ReadonlySet<string>;
	expressions(declaration: ts.VariableDeclaration, name: string): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(declaration: ts.VariableDeclaration, name: string): string;
}

/** Responsibilities: _factory object property operations_. **/
export interface TypeScriptFactoryObjectPropertiesContract {
	property_key(property: ts.ObjectLiteralElementLike): string;
	expressions(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(initializer: ts.ObjectLiteralExpression, property_name: string): string;
	binding_expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
}

/** Responsibilities: _namespace alias resolution_. **/
export interface TypeScriptNamespaceAliasesContract {
	names(): ReadonlySet<string>;
	target(initializer: ts.Expression): string;
}

/** Responsibilities: _object result detection_. **/
export interface TypeScriptContractNameLookupContract {
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
	append_parameter_rules(node: ts.Node, append_rule: RuleAppender): void;
	append_alias_rules(node: ts.Node, append_rule: RuleAppender): void;
}

/** Responsibilities: _TypeScript expression rule collection_. **/
export interface TypeScriptExpressionRulesContract {
	append(node: ts.Node, append_rule: RuleAppender): void;
}

/** Responsibilities: _TypeScript factory object sources_. **/
export interface TypeScriptFactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(expression: ts.Expression, visitor: ObjectSourceVisitor): void;
}
