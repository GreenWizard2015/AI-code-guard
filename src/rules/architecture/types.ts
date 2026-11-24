import type { AstCallableIdentity } from "src/model/ast/normalized_ast_types";
import type { AstClassNode, AstPythonImport, LineOnly, NamedLine } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _function placement AST input_. **/
export type PlacementFunctionNode = { identity: AstCallableIdentity };

/** Responsibilities: _module function placement inputs_. **/
export type ModulePlacementContext = {
	violations: ViolationContract[];
	file: string;
	functions: readonly PlacementFunctionNode[];
	entry_point: boolean;
};

/** Responsibilities: _function placement rule identifiers_. **/
export type FunctionPlacementRuleName =
	| "entry-point-function-count"
	| "free-function-outside-entry-point"
	| "functions-file-domain-class";

/** Responsibilities: _Python architecture analysis inputs_. **/
export type ArchitectureInput = {
	violations: ViolationContract[];
	file: string;
	accesses: LineOnly[];
	branches: LineOnly[];
	classes: AstClassNode[];
	type_declarations: readonly NamedLine[];
	imports: readonly AstPythonImport[];
};
