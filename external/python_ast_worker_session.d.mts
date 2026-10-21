import type { SpawnOptions } from "node:child_process";
import type { PythonAstWorkerContract } from "../src/core/python-ast-worker.mjs";

export declare class PythonAstWorkerSession {
	constructor(
		process_instance: NodeJS.Process,
		worker_arguments: string[],
		worker_options: SpawnOptions,
		worker_factory?: (arguments_list: string[], options: SpawnOptions) => PythonAstWorkerContract,
	);
	readonly worker_instance: PythonAstWorkerContract;
	close(): Promise<void>;
}
