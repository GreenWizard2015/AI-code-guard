import { PythonAstWorker } from "../src/core/python-ast-worker.mjs";

const PROCESS_MODULE_NAME = "process";
const PYTHON_AST_WORKER_KEY = Symbol.for("ai-code-guard.python-ast-worker");

export class PythonAstWorkerSession {
	constructor(process_instance, worker_arguments, worker_options) {
		const builtin_process = process_instance.getBuiltinModule?.(PROCESS_MODULE_NAME);
		const worker_process = builtin_process ?? process_instance;
		let worker = worker_process[PYTHON_AST_WORKER_KEY];
		if (worker === undefined) {
			worker = new PythonAstWorker(worker_arguments, worker_options, true);
			worker_process[PYTHON_AST_WORKER_KEY] = worker;
			worker_process.once("exit", () => worker.close());
		}
		this.worker_instance = worker;
	}
}
