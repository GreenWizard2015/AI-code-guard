import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PYTHON_PATH_VARIABLE, PYTHON_WORKER_LIFECYCLE_SCRIPT } from "tests/bridge/ts/core/python-ast/constants";

/** Responsibilities: _worker configuration_, _worker exit handling_. **/
export class PythonWorkerEventLoopScenario {
	private readonly _bridge: PythonAstBridge;
	private readonly _project_root: string;

	/** Responsibilities: _Python worker thread creation_. **/
	private create_worker(): Worker {
		const worker_module = pathToFileURL(resolve(this._project_root, "src/core/python-ast/python_ast_worker.mjs")).href;
		const worker_arguments = this._bridge.worker_arguments();
		const worker_environment = this._bridge.worker_options().env;
		let python_path = "";
		if (worker_environment !== undefined) {
			const configured_path = worker_environment[PYTHON_PATH_VARIABLE];
			if (configured_path !== undefined) {
				python_path = configured_path;
			}
		}
		const worker_options = {
			cwd: this._project_root,
			env: { ...process.env, PYTHONPATH: python_path },
			stdio: ["pipe", "pipe", "pipe"],
		};
		return new Worker(PYTHON_WORKER_LIFECYCLE_SCRIPT, {
			eval: true,
			workerData: { worker_module, worker_arguments, worker_options, io_timeout_ms: 10_000 },
		});
	}

	/** Responsibilities: _Python worker exit observation_. **/
	private observe_exit(worker: Worker): Promise<string> {
		return new Promise<string>((resolve_message, reject_message) => {
			let worker_message: unknown;
			worker.once("message", (message: unknown) => {
				worker_message = message;
			});
			worker.once("error", reject_message);
			worker.once("exit", (code) => {
				if (code !== 0) {
					reject_message(new Error(`Python AST worker thread exited with code ${code}`));
					return;
				}
				if (worker_message !== "worker exit observed") {
					reject_message(new Error(`Python AST worker thread exited before reporting: ${String(worker_message)}`));
					return;
				}
				resolve_message(String(worker_message));
			});
		});
	}

	/** Responsibilities: _worker scenario context_. **/
	public constructor(bridge: PythonAstBridge, project_root: string) {
		this._bridge = bridge;
		this._project_root = project_root;
	}

	/** Responsibilities: _Python worker event-loop result_. **/
	public result(): Promise<string> {
		return this.observe_exit(this.create_worker());
	}
}
