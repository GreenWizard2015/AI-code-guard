import type { SpawnOptions } from "node:child_process";
import type { PythonAstWorkerContract } from "../src/core/python-ast-worker.mjs";

export declare class PythonAstWorkerSession {
	constructor(process_instance: NodeJS.Process, worker_arguments: string[], worker_options: SpawnOptions);
	readonly worker_instance: PythonAstWorkerContract;
}
