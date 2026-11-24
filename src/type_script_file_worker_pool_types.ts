import type { MessagePort, Worker } from "node:worker_threads";
import type { FileLintRunOptions } from "src/core/types";
import type { FileLinterOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";

export type TypeScriptWorkerTimer = { name: string; duration_ms: number };

export type TypeScriptWorkerViolation = {
	file: string;
	line: number;
	message: string;
	hint: string;
	rule_id: string;
	priority: number;
};

export type TypeScriptWorkerOutput = {
	ok: boolean;
	parsed_files: number;
	violations: TypeScriptWorkerViolation[];
	timers: readonly TypeScriptWorkerTimer[];
	error: string;
	stack: string;
};

export type TypeScriptWorkerHandle = {
	worker: Worker;
	port: MessagePort;
	control: Int32Array;
	files: readonly string[];
};

export type TypeScriptWorkerFinishedResult = {
	files: readonly string[];
	output: TypeScriptWorkerOutput;
};

export type TypeScriptWorkerExecution = {
	linter_options: FileLinterOptions;
	run_options: FileLintRunOptions;
};

export type TypeScriptWorkerMainResults = ReadonlyMap<string, readonly ViolationContract[]>;
export type CallableTypeScriptWorkerMainWork = () => TypeScriptWorkerMainResults;

/** Responsibilities: _worker shard input_, _main-thread analysis operation_. **/
export interface TypeScriptWorkerRunRequestContract {
	shards(): readonly (readonly string[])[];
	execution(): TypeScriptWorkerExecution;
	main_work(): TypeScriptWorkerMainResults;
}

/** Responsibilities: _worker result collection_, _diagnostic merge contract_. **/
export interface TypeScriptWorkerResultAggregatorContract {
	collect(results: readonly TypeScriptWorkerFinishedResult[]): ReadonlyMap<string, readonly ViolationContract[]>;
	merge(
		main_results: ReadonlyMap<string, readonly ViolationContract[]>,
		worker_results: ReadonlyMap<string, readonly ViolationContract[]>,
	): ReadonlyMap<string, readonly ViolationContract[]>;
}
