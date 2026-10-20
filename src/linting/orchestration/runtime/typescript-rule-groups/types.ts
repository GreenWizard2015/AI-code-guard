import type {
	CallExpression as TypeScriptCallExpression,
	IfStatement as TypeScriptIfStatement,
	Node as TypeScriptNode,
	PropertyAccessExpression as TypeScriptPropertyAccessExpression,
	SourceFile as TypeScriptSourceFile,
} from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintFileNameContract } from "src/source_types";
import type { AstCallableNodeContract, AstClassField, AstClassNode, NormalizedAstFile } from "src/types";

export type RepeatedBranchSummary = { length: number; all_same: boolean; line: number };
export type RepeatedBranchVisitState = {
	violations: ViolationContract[];
	file: string;
	source_file: TypeScriptSourceFile;
	summaries: WeakMap<TypeScriptIfStatement, RepeatedBranchSummary>;
};

export type InlineViolationFlags = {
	object: boolean;
	union: boolean;
	generic: boolean;
	field_count: number;
};

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

/** Responsibilities: _temporal field reader ownership_, _reader lookup_. **/
export interface TemporalFieldReaderIndexContract {
	add(field: string, callable_index: number): void;
	different_callable_reads(field: string, callable_index: number): boolean;
}

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

export type CacheKeyOperation = {
	violations: ViolationContract[];
	file: string;
	source_file: TypeScriptSourceFile;
	reads: Map<string, string>;
	node: TypeScriptCallExpression;
	operation: string;
	receiver: string;
	key: string;
};

export type CacheOperationInput = {
	violations: ViolationContract[];
	file: string;
	source_file: TypeScriptSourceFile;
	reads: Map<string, string>;
	node: TypeScriptCallExpression;
	access: TypeScriptPropertyAccessExpression;
};

export type CacheKeyMismatch = {
	violations: ViolationContract[];
	file: string;
	source_file: TypeScriptSourceFile;
	node: TypeScriptCallExpression;
	reads: Map<string, string>;
	receiver: string;
	key: string;
};

export type TypeScriptCallableMetricsInput = {
	violations: ViolationContract[];
	file: string;
	functions: readonly AstCallableNodeContract[];
	methods: readonly AstCallableNodeContract[];
	classes: readonly AstClassNode[];
	fields: readonly AstClassField[];
};

/** Responsibilities: _rule-group execution_, _violation collection_. **/
export interface TypeScriptRuleGroupContract {
	append(violations: ViolationContract[]): void;
}

/** Responsibilities: _error classification_, _error diagnostic collection_. **/
export interface TypeScriptAstErrorRulesContract {
	append_empty_catches(violations: ViolationContract[]): void;
	append_error_context(violations: ViolationContract[]): void;
	append_duplicate_errors(violations: ViolationContract[]): void;
	append_error_rules(violations: ViolationContract[]): void;
}

/** Responsibilities: _type structure analysis_, _type diagnostic collection_. **/
export interface TypeScriptAstTypeRulesContract {
	append_callback_contracts(violations: ViolationContract[]): void;
	append_nested_generics(violations: ViolationContract[]): void;
	append_node(violations: ViolationContract[], source_file: TypeScriptSourceFile, node: TypeScriptNode): void;
	append_type_rules(violations: ViolationContract[]): void;
}

/** Responsibilities: _state exposure analysis_, _state diagnostic collection_. **/
export interface TypeScriptAstStateRulesContract {
	append_public_state(violations: ViolationContract[]): void;
	append_node(violations: ViolationContract[], source_file: TypeScriptSourceFile, node: TypeScriptNode): void;
}

/** Responsibilities: _special rule dispatch_, _auxiliary diagnostic collection_. **/
export interface TypeScriptAstSpecialRulesContract {
	append_error_rules(violations: ViolationContract[]): void;
	append_auxiliary_rules(violations: ViolationContract[]): void;
}

/** Responsibilities: _attempt states_, _termination states_. **/
export interface TypeScriptRetryRuleContract {
	retry_detection(
		violations: ViolationContract[],
		file: string,
		source_file: TypeScriptSourceFile,
		node: TypeScriptNode,
	): void;
}

/** Responsibilities: _cache operation analysis_, _cache key consistency_. **/
export interface TypeScriptCacheKeyRuleContract {
	append(violations: ViolationContract[], file: string, source_file: TypeScriptSourceFile, test_file: boolean): void;
	append_node(
		violations: ViolationContract[],
		file: string,
		source_file: TypeScriptSourceFile,
		node: TypeScriptNode,
	): void;
}

export type TypeScriptScannerState = {
	file_name: LintFileNameContract;
	ast: NormalizedAstFile;
	rules: TypeScriptRuleGroupContract;
};
