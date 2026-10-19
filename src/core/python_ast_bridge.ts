import { existsSync } from "node:fs";
import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PythonAstWorker } from "src/core/python-ast-worker.mjs";
import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import { PYTHON_BRIDGE_DIRECTORY } from "src/constants";
import { COVERAGE_MODULE, COVERAGE_PARALLEL_MODE_ARGUMENT, COVERAGE_RUN_COMMAND } from "src/core/constants";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type { ProjectAnalysisIdentityContract, PythonAstDataOptions } from "src/protocols";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _Python bridge configuration_, _worker construction_, _cache identity composition_. **/
export class PythonAstBridge implements PythonAstDataOptions {
	public readonly worker: PythonAstWorkerContract;
	public readonly analysis_identity: ProjectAnalysisIdentityContract;
	public readonly split_batch_enabled = false;
	public readonly file_io: IOContract;

	private readonly project_root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	private readonly python_bridge_path = resolve(this.project_root, PYTHON_BRIDGE_DIRECTORY);
	private readonly python_path = [this.python_bridge_path, this.project_root].join(delimiter);
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
		const file_io = new NodeFileIO();
		this.worker = new PythonAstWorker(this.worker_arguments(), this.worker_options(), false);
		this.analysis_identity = new ProjectAnalysisIdentity(file_io);
		this.file_io = file_io;
	}

	/** Responsibilities: _resolution Python bridge entrypoint_. **/
	public bridge_path(): string {
		const bridge_file = resolve(this.project_root, this.bridge_file_name);
		if (!existsSync(bridge_file)) {
			throw new Error("Python AST bridge script was not found.");
		}
		return bridge_file;
	}

	/** Responsibilities: _construction arguments one-shot Python_. **/
	public bridge_arguments(batch = false): string[] {
		const bridge_file = this.bridge_path();
		const bridge_arguments = this.bridge_file_arguments(bridge_file, batch);
		if (!process.env.COVERAGE_PROCESS_START?.trim()) {
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
			env: { ...process.env, PYTHONPATH: this.python_path },
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
}
