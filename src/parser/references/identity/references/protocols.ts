import type { CallableReferenceIdentity } from "src/model/ast/normalized_ast_types";
import type {
	TypeScriptCallReturnsContract,
	TypeScriptInstanceStoreContract,
	TypeScriptPropertyStateContract,
	TypeScriptReferenceIdentityContract,
	TypeScriptReferenceResolutionContract,
} from "src/model/protocols";
import type {
	TypeScriptInstanceFilesContract,
	TypeScriptPropertyInstanceFilesContract,
	TypeScriptReferenceFileIndexContract,
} from "src/model/protocols";
import type { TypeScriptReferenceOwnerQueryKind } from "src/model/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptPropertySide } from "src/types";
import type { TypeScriptReferenceOwnershipContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _property declaration lookup dependencies_. **/
export type TypeScriptPropertyReferenceIdentityOptions = {
	readonly source_file: ts.SourceFile;
	readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	readonly instance_files: TypeScriptInstanceFilesContract;
	readonly properties: TypeScriptPropertyInstanceFilesContract;
	readonly file_index: TypeScriptReferenceFileIndexContract;
	readonly this_receiver: TypeScriptThisReceiverContract;
};

/** Responsibilities: _inherited method search options_. **/
export type TypeScriptInheritedMethodSearchOptions = {
	file: string;
	class_name: string;
	method: string;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	module_exports: TypeScriptModuleExportsContract;
	seen: Set<string>;
};

/** Responsibilities: _inherited method search operations_. **/
export interface TypeScriptInheritedMethodSearchContract {
	file(): string;
	contains(): boolean;
}

/** Responsibilities: _inherited method lookup operations_. **/
export interface TypeScriptInheritedMethodsContract {
	file(file: string, class_name: string, method: string): string;
	contains(file: string, class_name: string, method: string): boolean;
}

/** Responsibilities: _imported property ownership_. **/
export interface TypeScriptImportedPropertyOwnerContract {
	property_owner(owner: string, property: string): string;
}

/** Responsibilities: _receiver ownership_, _property side_. **/
export interface TypeScriptThisReceiverContract {
	owner(expression: ts.Expression): string;
	side(expression: ts.Expression): TypeScriptPropertySide;
}

/** Responsibilities: _reference state initialization_. **/
export interface TypeScriptReferenceStateInitializationContract {
	initialize(): void;
}

/** Responsibilities: _reference initialization state_. **/
export type TypeScriptReferenceStateInitializationState = {
	readonly aliases: Map<string, string>;
	readonly function_identities: Map<string, CallableReferenceIdentity>;
	readonly instances: TypeScriptInstanceStoreContract;
	readonly property_state: TypeScriptPropertyStateContract;
	readonly ownership: TypeScriptReferenceOwnershipContract;
};

/** Responsibilities: _reference initialization input_. **/
export type TypeScriptReferenceStateInitializationContext = {
	readonly source: TypeScriptReferenceOwnershipOptions;
	readonly state: TypeScriptReferenceStateInitializationState;
};

/** Responsibilities: _expression owner context_. **/
export type TypeScriptReferenceExpressionOwnerContext = {
	readonly aliases: Map<string, string>;
	readonly instances: TypeScriptInstanceStoreContract;
	readonly property_state: TypeScriptPropertyStateContract;
	readonly imported_property_owner: TypeScriptImportedPropertyOwnerContract;
	readonly call_returns: TypeScriptCallReturnsContract;
	readonly reference_identity: TypeScriptReferenceIdentityContract;
	readonly this_receiver: TypeScriptThisReceiverContract;
	readonly initializer: TypeScriptReferenceStateInitializationContract;
};

/** Responsibilities: _method reference ownership_. **/
export type TypeScriptMethodReferenceRequest = {
	readonly expression: ts.Expression;
};

/** Responsibilities: _member reference ownership_. **/
export type TypeScriptAccessReferenceRequest = {
	readonly expression: ts.AccessExpression;
};

/** Responsibilities: _reference owner mapping_. **/
export type TypeScriptReferenceOwnerRequest = {
	readonly kind: TypeScriptReferenceOwnerQueryKind;
	readonly expression: ts.Expression;
};

/** Responsibilities: _reference ownership resolver_. **/
export interface TypeScriptReferenceOwnerResolverContract {
	resolve_method_reference(request: TypeScriptMethodReferenceRequest): TypeScriptReferenceResolutionContract;
	resolve_owner(request: TypeScriptReferenceOwnerRequest): TypeScriptReferenceResolutionContract;
}

/** Responsibilities: _reference ownership constructor inputs_. **/
export type TypeScriptReferenceOwnershipOptions = {
	readonly source_file: ts.SourceFile;
	readonly traversal: TypeScriptAstTraversalContract;
	readonly project_root: string;
	readonly stage_timer: LintStageTimerContract;
	readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	readonly source_io: ProjectSourceIOContract;
};
