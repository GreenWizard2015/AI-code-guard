import { PythonAstWorker } from "../src/core/python-ast-worker.mjs";

const PROCESS_MODULE_NAME = "process";
const PYTHON_AST_WORKERS_KEY = Symbol.for("ai-code-guard.python-ast-workers");

function stable_value(value) {
	if (Array.isArray(value)) return value.map(stable_value);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable_value(value[key])]));
}

function worker_key(worker_arguments, worker_options) {
	return JSON.stringify(stable_value([worker_arguments, worker_options]));
}

export class PythonAstWorkerSession {
	constructor(process_instance, worker_arguments, worker_options, worker_factory) {
		const builtin_process = process_instance.getBuiltinModule?.(PROCESS_MODULE_NAME);
		const worker_process = builtin_process ?? process_instance;
		let workers = worker_process[PYTHON_AST_WORKERS_KEY];
		if (workers === undefined) {
			workers = new Map();
			worker_process[PYTHON_AST_WORKERS_KEY] = workers;
			worker_process.once("exit", () => {
				for (const entry of workers.values()) entry.worker.close();
			});
		}
		this.workers = workers;
		this.key = worker_key(worker_arguments, worker_options);
		let entry = workers.get(this.key);
		if (entry === undefined) {
			const factory = worker_factory ?? ((arguments_list, options) => new PythonAstWorker(arguments_list, options, true));
			entry = { worker: factory(worker_arguments, worker_options), leases: 0 };
			workers.set(this.key, entry);
		}
		entry.leases += 1;
		this.worker_instance = entry.worker;
		this.closed = false;
	}

	async close() {
		if (this.closed) return;
		this.closed = true;
		const entry = this.workers.get(this.key);
		if (entry === undefined) return;
		entry.leases -= 1;
		if (entry.leases > 0) return;
		this.workers.delete(this.key);
		await entry.worker.close();
	}
}
