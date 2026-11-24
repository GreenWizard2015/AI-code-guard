import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
	TypeScriptFactoryObjectBindingSourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _array source candidate context_. **/
export type TypeScriptFactoryArraySourceCandidateOptions = {
	readonly element: ts.Node;
	readonly value: ts.Expression;
	readonly name: string;
	readonly expression_names: ExpressionNamesContract;
	readonly object_sources: FactoryObjectSourcesContract;
	readonly object_bindings: TypeScriptFactoryObjectBindingSourcesContract;
	readonly array_sources: TypeScriptFactoryArraySourcesContract;
};
