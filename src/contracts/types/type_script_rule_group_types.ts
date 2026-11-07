import type { TemporalFieldReaderIndexContract } from "src/analysis_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { StaticExpressionOperationsContract } from "src/shared_services_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type {
	AccessExpression as TypeScriptAccessExpression,
	Node as TypeScriptNode,
	SourceFile as TypeScriptSourceFile,
} from "typescript";

export type TemporalCallableState = {
	node: TypeScriptNode;
	writes: Set<string>;
	reads: Set<string>;
};

export type TemporalFieldAccess = {
	present: boolean;
	name: string;
	read: boolean;
	write: boolean;
};

export type PrivateAccessAnalysisOptions = {
	readonly source_file: TypeScriptSourceFile;
	readonly static_expression_operations: StaticExpressionOperationsContract;
	readonly traversal: TypeScriptAstTraversalContract;
};

/** Responsibilities: _private access node collection_, _private access reporting_. **/
export interface PrivateAccessAnalysisContract {
	append_node(node: TypeScriptNode): void;
	append_private_access(violations: ViolationContract[], file: string): void;
}

export type PrivateAccessCandidate = {
	readonly access: TypeScriptAccessExpression;
	readonly current_owner: string;
	readonly name: string;
};

export type TemporalAppendCallableInput = {
	violations: ViolationContract[];
	file: string;
	field_readers: TemporalFieldReaderIndexContract;
	initialized: Set<string>;
	index: number;
	callables: readonly TemporalCallableState[];
};

export type TemporalWriteInput = {
	violations: ViolationContract[];
	file: string;
	initialized: Set<string>;
	callable: TemporalCallableState;
	index: number;
	field_readers: TemporalFieldReaderIndexContract;
};
