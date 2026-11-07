import type { ImportedFunction } from "src/model/ast/normalized_ast_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type ts from "typescript";

/** Responsibilities: _variable binding lookup_, _primitive classification_. **/
export interface TypeScriptVariableBindingContract {
	declaration(name: string, reference: ts.Node): ts.Node;
	primitive(name: string, reference: ts.Node): boolean;
}

/** Responsibilities: _imported function alias lookup_, _imported function name collection_. **/
export interface TypeScriptImportedFunctionAliasesContract {
	imported_function_aliases(source_file: ts.SourceFile): Map<string, ImportedFunction>;
	imported_function_names(imports: ReadonlyMap<string, ImportedFunction>): ReadonlySet<string>;
}

/** Responsibilities: _call alias candidate state_. **/
export type TypeScriptCallAliasCandidate = {
	readonly aliases: Map<string, string>;
	readonly name: string;
	readonly initializer: ts.Expression;
};

/** Responsibilities: _membership alias resolution state_. **/
export type TypeScriptMembershipAliasScope = {
	readonly names: Set<string>;
	readonly object_aliases: Map<string, ts.ObjectLiteralExpression>;
	readonly source_file: ts.SourceFile;
};

export type CallableTypeScriptNodeVisitor = (body: ts.Node) => void;

export type CallableCallReferenceVisitor = (node: ts.Node, owner: string) => void;

/** Responsibilities: _AST node verification inputs_. **/
export type TypeScriptNodeVerificationRequest = {
	readonly node: ts.Node;
	readonly context: RuleContextContract;
};

/** Responsibilities: _source AST verification phases_. **/
export type TypeScriptSourceVerificationRequest = {
	readonly source_root: ts.Node;
	readonly context: RuleContextContract;
	readonly stage_timer: LintStageTimerContract;
};

/** Responsibilities: _visible variable declaration criteria_. **/
export type VisibleVariableDeclarationQuery = {
	readonly declarations: readonly ts.VariableDeclaration[];
	readonly scopes: readonly ts.Node[];
	readonly reference: ts.Node;
};

/** Responsibilities: _TypeScript node rule application_. **/
/** Responsibilities: _function type rule input_. **/
export type TypeScriptFunctionTypeRuleRequest = {
	readonly node: ts.FunctionTypeNode;
	readonly owner: ts.Node;
	readonly context: RuleContextContract;
	readonly callable_alias: boolean;
};

export type CallableTypeScriptNodeVerifier = (request: TypeScriptNodeVerificationRequest) => void;
