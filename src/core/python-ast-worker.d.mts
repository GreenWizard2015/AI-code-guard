import type { NormalizedAstFile } from "src/types";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { PythonAstWorkerTransportContract } from "./python-ast-worker-transport.mjs";

export type PythonAstWorkerSpawnProcess = (
	command: string,
	arguments_list: string[],
	options: SpawnOptions,
) => ChildProcess;

export type PythonAstWorkerSources = { [name: string]: string };
export type PythonAstWorkerAsts = ReadonlyMap<string, NormalizedAstFile>;
export type PythonAstStageTiming = {
	name: string;
	duration_ms: number;
};
export type PythonAstWorkerTimings = {
	ast_parse_ms: number;
	ast_build_ms: number;
	ast_stages: PythonAstStageTiming[];
};

export type PythonAstWorkerResponse = {
	batchId: string;
	asts: PythonAstWorkerAsts;
	timings: PythonAstWorkerTimings;
};

export interface PythonAstWorkerContract {
	batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse;
	close(): void | Promise<void>;
	start_batch?(batch_id: string, sources: PythonAstWorkerSources): void;
	complete_batch?(): PythonAstWorkerResponse;
}

export declare class PythonAstWorker implements PythonAstWorkerContract {
	constructor(
		arguments_list: string[],
		options: SpawnOptions,
		persistent: boolean,
		io_timeout_ms?: number,
		spawn_process?: PythonAstWorkerSpawnProcess,
		transport?: PythonAstWorkerTransportContract,
	);
	start_persistent(): void;
	is_active(): boolean;
	process_id(): number;
	wait_for_exit(): Promise<void>;
	process_exited(): boolean;
	batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse;
	batch_error(batch_id: string, sources: PythonAstWorkerSources): string;
	start_batch(batch_id: string, sources: PythonAstWorkerSources): void;
	complete_batch(): PythonAstWorkerResponse;
	close(): void | Promise<void>;
}
