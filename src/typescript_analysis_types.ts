import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ImportedFunction } from "src/types";
import type ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

export type TypeScriptVariableBindingContract = {
	declaration(name: string, reference: ts.Node): ts.Node;
	primitive(name: string, reference: ts.Node): boolean;
};

export type TypeScriptImportedFunctionAliasesContract = {
	imported_function_aliases(source_file: ts.SourceFile): Map<string, ImportedFunction>;
	imported_function_names(imports: ReadonlyMap<string, ImportedFunction>): ReadonlySet<string>;
};

/** Responsibilities: _TypeScript script-rule service options_. **/
export type TypeScriptScriptRuleOptions = {
	violations: ViolationContract[];
	file: string;
	source_file: ts.SourceFile;
	index: TypeScriptAstNodeCollection;
	traversal: TypeScriptAstTraversalContract;
	stage_timer: LintStageTimerContract;
	module_resolver: TypeScriptModuleResolverContract;
};

export type TypeScriptNodeVisitor = (body: ts.Node) => void;

export type TypeScriptMetadataNodeVisitor = (node: ts.Node, owner: string) => void;
