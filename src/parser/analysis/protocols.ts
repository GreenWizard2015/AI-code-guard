import type { CallableStaticValueResolver } from "src/runtime_types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { CallableTypeScriptAstNodeObserver } from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _AST dispatch phase names_. **/
export enum TypeScriptAstDispatchPhase {
	SourceMetadata = "source_metadata",
	ReferenceState = "reference_state",
	FileRules = "file_rules",
	ProjectIndex = "project_index",
}

/** Responsibilities: _phase observer associations_, _registered node kinds_. **/
export type TypeScriptAstDispatchPhaseState<TContext> = {
	readonly observers_by_kind: TypeScriptAstDispatchObserverTable<TContext>;
	readonly registered_kinds: Uint8Array;
};

/** Responsibilities: _finite phase state record_. **/
export type TypeScriptAstDispatchPhaseStateMap<TContext> = {
	readonly source_metadata: TypeScriptAstDispatchPhaseState<TContext>;
	readonly reference_state: TypeScriptAstDispatchPhaseState<TContext>;
	readonly file_rules: TypeScriptAstDispatchPhaseState<TContext>;
	readonly project_index: TypeScriptAstDispatchPhaseState<TContext>;
};

/** Responsibilities: _observer list for each AST kind_. **/
export type TypeScriptAstDispatchObserverList<TContext> = CallableTypeScriptAstNodeObserver<TContext>[];

/** Responsibilities: _AST kind observer lists_. **/
export type TypeScriptAstDispatchObserverTable<TContext> = TypeScriptAstDispatchObserverList<TContext>[];

/** Responsibilities: _constructor statement policy_, _field initializer policy_. **/
export interface ConstructorRulesContract {
	statement_allowed(statement: ts.Statement): boolean;
	field_initializer_allowed(node: ts.PropertyDeclaration): boolean;
}

/** Responsibilities: _parameter property classification_. **/
export interface DeclarationPredicatesContract {
	parameter_property(node: ts.Node): boolean;
}

/** Responsibilities: _static object binding state_, _static assignment classification_. **/
export interface StaticObjectBindingsContract {
	append(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		node: ts.VariableDeclaration,
	): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
}

/** Responsibilities: _member alias property matching_, _source alias lookup_. **/
export type StoredAliasNames = {
	readonly expression_name: string;
	readonly property_name: string;
};

/** Responsibilities: _member alias property matching_, _source alias lookup_. **/
export interface StoredAliasDeclarationIndexContract {
	member_alias_property(
		expression: ts.Expression,
		node: ts.Node,
		name: string,
		member_aliases: TypeScriptMemberAliasesContract,
	): boolean;
	source_has_alias(source_file: ts.SourceFile, expression_name: string, property_name: string): boolean;
}

/** Responsibilities: _bind alias classification_, _target member contract_. **/
export interface TypeScriptStoredBindAliasContract {
	target_member(expression: ts.Expression, node: ts.CallExpression): boolean;
	matches(
		node: ts.Node,
		expression: ts.Expression,
		member_aliases: TypeScriptMemberAliasesContract,
		static_value: CallableStaticValueResolver,
	): boolean;
}

/** Responsibilities: _bind analysis context_. **/
export type TypeScriptStoredBindCallOptions = {
	readonly node: ts.CallExpression;
	readonly expression: ts.Expression;
	readonly member_aliases: TypeScriptMemberAliasesContract;
	readonly static_value: CallableStaticValueResolver;
	readonly alias_declarations: StoredAliasDeclarationIndexContract;
};

/** Responsibilities: _bind call operations_. **/
export interface TypeScriptStoredBindCallContract {
	matches(): boolean;
	stored_member(member: ts.Expression): boolean;
}
