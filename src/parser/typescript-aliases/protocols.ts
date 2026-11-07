import type { StaticArrayAssignment } from "src/analysis_protocols";
import type { StringSetMap } from "src/analysis_types";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import type { TypeScriptMemberAliasTarget } from "src/typescript_analysis_protocols";
import type {
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptStaticObjectArgumentsContract,
} from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

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
	append_rest(source: StaticArrayAssignment): boolean;
}

/** Responsibilities: _static object source candidate_. **/
export type TypeScriptStaticExpressionSourceCandidate = {
	readonly name: string;
	readonly current: ts.Expression;
};

/** Responsibilities: _static object binding target_. **/
export type TypeScriptStaticObjectBindingTarget = {
	readonly values: Map<string, string>;
	readonly element: ts.BindingElement;
	readonly source: ts.ObjectLiteralExpression;
};

/** Responsibilities: _static object binding collection_. **/
export type TypeScriptStaticObjectBindingCollection = {
	readonly values: Map<string, string>;
	readonly binding: ts.ObjectBindingPattern;
	readonly source: ts.ObjectLiteralExpression;
};

/** Responsibilities: _static object binding source_. **/
export type TypeScriptStaticObjectBindingSource = {
	readonly values: Map<string, string>;
	readonly binding: ts.ObjectBindingPattern;
	readonly current: ts.Expression;
};

/** Responsibilities: _static object binding declaration_. **/
export type TypeScriptStaticObjectBindingDeclaration = {
	readonly values: Map<string, string>;
	readonly node: ts.VariableDeclaration;
};

/** Responsibilities: _static expression node lookup_. **/
export type TypeScriptStaticExpressionNodeQuery = {
	readonly node: ts.Node;
};

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

/** Responsibilities: _object binding collections_, _object source arguments_. **/
export type StaticObjectBindingContext = {
	readonly values: Map<string, string>;
	readonly objects: Map<string, ts.ObjectLiteralExpression>;
	readonly arguments_source: TypeScriptStaticObjectArgumentsContract;
	readonly declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
};

/** Responsibilities: _destructuring target_, _initializer expression_. **/
export type StaticObjectBindingQuery = {
	readonly binding: ts.BindingName;
	readonly initializer: ts.Expression;
};

/** Responsibilities: _named object property target_, _object property source_. **/
export type StaticNamedObjectPropertyQuery = {
	readonly target_name: string;
	readonly source_name: string;
	readonly initializer: ts.ObjectLiteralExpression;
};

/** Responsibilities: _nested object binding target_, _object property source_. **/
export type StaticNestedObjectPropertyQuery = {
	readonly target: ts.BindingName;
	readonly source_name: string;
	readonly initializer: ts.ObjectLiteralExpression;
};

/** Responsibilities: _object binding pattern_, _object initializer_. **/
export type StaticObjectPropertiesQuery = {
	readonly binding: ts.ObjectBindingPattern;
	readonly initializer: ts.ObjectLiteralExpression;
};

/** Responsibilities: _array binding pattern_, _array initializer_. **/
export type StaticArrayPropertiesQuery = {
	readonly binding: ts.ArrayBindingPattern;
	readonly initializer: ts.ArrayLiteralExpression;
};

/** Responsibilities: _array binding element_, _array element value_. **/
export type StaticArrayBindingElementQuery = {
	readonly element: ts.BindingElement;
	readonly value: ts.Expression;
};

/** Responsibilities: _object binding_, _object source_. **/
export type StaticObjectBindingSourceQuery = {
	readonly binding: ts.ObjectBindingPattern;
	readonly current: ts.Expression;
};

/** Responsibilities: _array binding_, _array source_. **/
export type StaticArrayBindingSourceQuery = {
	readonly binding: ts.ArrayBindingPattern;
	readonly current: ts.Expression;
};

/** Responsibilities: _binding target_, _source expression_. **/
export type ResolvedStaticBindingQuery = {
	readonly binding: ts.BindingName;
	readonly current: ts.Expression;
};

/** Responsibilities: _declaration binding context_, _variable declaration_. **/
export type StaticObjectDeclarationQuery = {
	readonly context: StaticObjectBindingContext;
	readonly node: ts.VariableDeclaration;
};

/** Responsibilities: _source file selection_. **/
export type StaticArraySourceCollectionQuery = {
	readonly source_file: ts.SourceFile;
};

/** Responsibilities: _binding property name resolution_. **/
export interface BindingPropertyNameResolverContract {
	property_name(element: ts.Node): string;
}

/** Responsibilities: _destructured binding alias traversal_. **/
export interface BindingAliasTraversalContract {
	append(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean;
}

/** Responsibilities: _object alias registration_, _array alias registration_. **/
export interface DestructuredBindingAliasAppenderContract {
	append_object(binding: ts.ObjectBindingPattern, value: ts.ObjectLiteralExpression): boolean;
	append_array(binding: ts.ArrayBindingPattern, value: ts.ArrayLiteralExpression): boolean;
}

/** Responsibilities: _member variable alias context_. **/
export type VariableAliasContext = {
	readonly aliases: StringSetMap;
	readonly node: ts.VariableDeclaration;
};

/** Responsibilities: _member alias destination_, _source member name_. **/
export type MemberAliasCopyQuery = {
	readonly target: TypeScriptMemberAliasTarget;
	readonly source_name: string;
};

/** Responsibilities: _member access alias target_, _member access expression_, _scope source_. **/
export type MemberAliasAccessQuery = {
	readonly target: TypeScriptMemberAliasTarget;
	readonly expression: ts.Expression;
	readonly node: ts.Node;
};

/** Responsibilities: _member alias collection_, _object binding pattern_. **/
export type MemberBindingAliasQuery = {
	readonly aliases: StringSetMap;
	readonly binding: ts.ObjectBindingPattern;
};
