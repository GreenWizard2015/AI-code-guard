import type { TypeScriptInstanceStoreContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import type { InstanceAliasResolversContract } from "src/types";
import type { TypeScriptCallReturnAnalysisContract } from "src/typescript_analysis_protocols";
import type { TypeScriptReferenceBindingContract } from "src/typescript_analysis_protocols";
import type { TypeScriptObjectPropertyCollectorContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

export type InstanceBinding = { declaration: ts.Node; owner: string };
export type InstanceBindingsByName = Map<string, InstanceBinding[]>;

/** Responsibilities: _instance alias collection inputs_. **/
export type TypeScriptInstanceAliasCollectorOptions = {
	readonly source_file: ts.SourceFile;
	readonly traversal: TypeScriptAstTraversalContract;
	readonly aliases: Map<string, string>;
	readonly instances: TypeScriptInstanceStoreContract;
	readonly properties: TypeScriptPropertyStateContract;
	readonly resolvers: InstanceAliasResolversContract;
};

/** Responsibilities: _single variable alias input_, _alias resolution services_. **/
export type TypeScriptVariableInstanceAliasOptions = {
	readonly node: ts.VariableDeclaration;
	readonly owner: string;
	readonly source_file: ts.SourceFile;
	readonly instances: TypeScriptInstanceStoreContract;
	readonly properties: TypeScriptPropertyStateContract;
	readonly resolvers: InstanceAliasResolversContract;
	readonly object_properties: TypeScriptObjectPropertyCollectorContract;
	readonly reference_helpers: TypeScriptReferenceBindingContract;
	readonly call_return_analysis: TypeScriptCallReturnAnalysisContract;
};
