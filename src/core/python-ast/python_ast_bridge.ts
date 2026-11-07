import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PYTHON_BRIDGE_DIRECTORY } from "src/constants";
import {
	COVERAGE_MODULE,
	COVERAGE_PARALLEL_MODE_ARGUMENT,
	COVERAGE_RUN_COMMAND,
	NODE_ENV_VARIABLE,
} from "src/core/constants";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PYTHON_AST_WORKER_IO_TIMEOUT_MS } from "src/core/python-ast/constants";
import { PythonAstWorker } from "src/core/python-ast/python_ast_worker.mjs";
import type { PythonAstBridgeOptions, PythonAstWorkerOptions } from "src/core/python-ast/types";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";
import type { PythonAstWorkerContract } from "src/python_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";

/** Responsibilities: _Python bridge configuration_, _worker construction_, _cache identity composition_. **/
export class PythonAstBridge {
	public readonly _worker: PythonAstWorkerContract;
	public readonly _analysis_identity: ProjectAnalysisIdentityContract;
	public readonly _split_batch_enabled = false;
	public readonly _file_io: IOContract;
	public readonly _cache_enabled: boolean;
	private readonly _project_root: string;
	private readonly _python_bridge_path: string;
	private readonly _python_path: string;
	private readonly bridge_file_name = "src/python-bridge/python_bridge_entrypoint.py";

	/** Responsibilities: _construction command-line arguments bridge_. **/
	private bridge_file_arguments(bridge_file: string, batch: boolean): string[] {
		if (!batch) {
			return [bridge_file];
		}
		return [bridge_file, "--batch"];
	}
	/** Responsibilities: _default worker composition_. **/
	public constructor() {
		this._project_root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
		this._python_bridge_path = resolve(this._project_root, PYTHON_BRIDGE_DIRECTORY);
		this._python_path = [this._python_bridge_path, this._project_root].join(delimiter);
		const resolved_file_io: IOContract = new NodeFileIO(process.cwd());
		const worker_options: PythonAstWorkerOptions = {
			arguments_list: this.worker_arguments(),
			options: this.worker_options(),
			persistent: false,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		};
		this._worker = new PythonAstWorker(worker_options);
		this._analysis_identity = new ProjectAnalysisIdentity(resolved_file_io);
		this._file_io = resolved_file_io;
		this._cache_enabled = process.env[NODE_ENV_VARIABLE] !== "test";
	}

	/** Responsibilities: _resolution Python bridge entrypoint_. **/
	public bridge_path(): string {
		const bridge_file = resolve(this._project_root, this.bridge_file_name);
		if (!existsSync(bridge_file)) {
			throw new Error("Python AST bridge script was not found.");
		}
		return bridge_file;
	}

	/** Responsibilities: _construction arguments one-shot Python_. **/
	public bridge_arguments(batch = false): string[] {
		const coverage_key = "COVERAGE_PROCESS_START";
		const bridge_file = this.bridge_path();
		const bridge_arguments = this.bridge_file_arguments(bridge_file, batch);
		const coverage_configuration = process.env[coverage_key];
		if (coverage_configuration === undefined || !coverage_configuration.trim()) {
			return bridge_arguments;
		}
		return ["-m", COVERAGE_MODULE, COVERAGE_RUN_COMMAND, COVERAGE_PARALLEL_MODE_ARGUMENT, ...bridge_arguments];
	}

	/** Responsibilities: _construction arguments persistent Python_. **/
	public worker_arguments(): string[] {
		return [...this.bridge_arguments(), "--worker"];
	}

	/** Responsibilities: _construction synchronous process options_. **/
	public bridge_options(text: string): SpawnSyncOptionsWithStringEncoding {
		return {
			input: `code:${text}`,
			encoding: "utf8" as const,
			maxBuffer: 4 * 1024 * 1024,
			env: { ...process.env, PYTHONPATH: this._python_path },
		};
	}

	/** Responsibilities: _persistent-worker process options construction_. **/
	public worker_options(): SpawnOptions {
		const bridge_options = this.bridge_options("");
		return {
			stdio: ["pipe", "pipe", "pipe"],
			env: bridge_options.env,
		};
	}

	/** Responsibilities: _Python AST parser options_. **/
	public options(): PythonAstBridgeOptions {
		return {
			worker: this._worker,
			analysis_identity: this._analysis_identity,
			split_batch_enabled: this._split_batch_enabled,
			file_io: this._file_io,
			cache_enabled: this._cache_enabled,
		};
	}
}
