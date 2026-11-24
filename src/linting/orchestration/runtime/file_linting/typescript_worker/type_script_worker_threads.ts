import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { serialize } from "node:v8";
import {
	MessageChannel,
	type MessagePort,
	Worker,
	type WorkerOptions,
	receiveMessageOnPort,
} from "node:worker_threads";
import { BUNDLED_WORKER_ENTRY_PATH, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type {
	TypeScriptWorkerFinishedResult,
	TypeScriptWorkerHandle,
	TypeScriptWorkerOutput,
} from "src/type_script_file_worker_pool_types";
import type { TypeScriptWorkerBootstrapInput, TypeScriptWorkerParseSnapshot } from "src/typescript_file_worker_types";

/** Responsibilities: _worker startup_, _worker result collection_, _worker shutdown_. **/
export class TypeScriptWorkerThreads {
	private readonly _workers: TypeScriptWorkerHandle[];

	/** Responsibilities: _worker module URL selection_. **/
	private selected_worker_entry(module_url: string): URL {
		if (module_url.endsWith(".ts")) {
			const bundled_worker_entry = new URL(BUNDLED_WORKER_ENTRY_PATH, module_url);
			if (existsSync(bundled_worker_entry)) {
				return bundled_worker_entry;
			}
			return new URL("./type_script_worker_entry.ts", module_url);
		}
		return new URL("./typescript_file_worker_entry.mjs", module_url);
	}

	/** Responsibilities: _worker startup options_. **/
	private worker_options(files: readonly string[], control: SharedArrayBuffer, port: MessagePort): WorkerOptions {
		const bundled_worker_entry = new URL(BUNDLED_WORKER_ENTRY_PATH, import.meta.url);
		const source_mode = import.meta.url.endsWith(".ts") && !existsSync(bundled_worker_entry);
		let exec_argv: string[] = [];
		if (source_mode) {
			exec_argv = process.execArgv;
			if (!exec_argv.includes("tsx")) {
				exec_argv = [...exec_argv, "--import", "tsx"];
			}
		}
		const worker_data: TypeScriptWorkerBootstrapInput = {
			files,
			control,
			port,
			typescript_module_name: TYPESCRIPT_CACHE_OWNER,
		};
		return { workerData: worker_data, transferList: [port], execArgv: exec_argv };
	}

	/** Responsibilities: _worker readiness_. **/
	private wait_for_completion(worker: Worker, control: Int32Array): void {
		const started_at = Date.now();
		while (Atomics.load(control, 0) === 0) {
			if (worker.threadId === -1) {
				throw new Error("TypeScript worker exited before sending its result.");
			}
			const elapsed_ms = Date.now() - started_at;
			if (elapsed_ms >= 120_000) {
				throw new Error("TypeScript worker timed out after 120 seconds.");
			}
			Atomics.wait(control, 0, 0, Math.min(1000, 120_000 - elapsed_ms));
		}
		if (Atomics.load(control, 0) !== 1) {
			throw new Error("TypeScript worker returned an invalid completion signal.");
		}
	}

	/** Responsibilities: _worker result receipt_. **/
	private result(handle: TypeScriptWorkerHandle): TypeScriptWorkerOutput {
		this.wait_for_completion(handle.worker, handle.control);
		const received = receiveMessageOnPort(handle.port);
		handle.port.close();
		if (received === undefined) {
			throw new Error("TypeScript worker returned an invalid result.");
		}
		const output: TypeScriptWorkerOutput = received.message;
		if (!output.ok) {
			throw new Error(`TypeScript worker failed: ${output.error}\n${output.stack}`);
		}
		return output;
	}

	/** Responsibilities: _worker thread initialization_. **/
	public constructor() {
		this._workers = [];
	}

	/** Responsibilities: _worker startup_. **/
	public start(shards: readonly (readonly string[])[]): void {
		if (this._workers.length > 0) {
			throw new Error("TypeScript workers have already started.");
		}
		for (const shard of shards) {
			const control_buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
			const control = new Int32Array(control_buffer);
			const channel = new MessageChannel();
			const worker = new Worker(
				this.selected_worker_entry(import.meta.url),
				this.worker_options(shard, control_buffer, channel.port2),
			);
			this._workers.push({ worker, port: channel.port1, control, files: shard });
		}
	}

	/** Responsibilities: _worker context snapshot delivery_. **/
	public provide_snapshots(snapshots: readonly TypeScriptWorkerParseSnapshot[]): void {
		if (this._workers.length === 0) {
			throw new Error("TypeScript workers must start before snapshot delivery.");
		}
		if (snapshots.length !== this._workers.length) {
			throw new Error("TypeScript AST worker snapshots do not match the active worker count.");
		}
		for (const [index, worker] of this._workers.entries()) {
			const snapshot = snapshots[index];
			if (snapshot === undefined) {
				throw new Error("TypeScript AST worker snapshot is missing.");
			}
			const enqueued_at_ms = performance.timeOrigin + performance.now();
			worker.port.postMessage(serialize({ ...snapshot, enqueued_at_ms }));
		}
	}

	/** Responsibilities: _worker results_. **/
	public results(): TypeScriptWorkerFinishedResult[] {
		return this._workers.map((worker) => ({ files: worker.files, output: this.result(worker) }));
	}

	/** Responsibilities: _worker shutdown_. **/
	public stop(): void {
		for (const { worker, port } of this._workers) {
			port.close();
			worker.terminate().then(
				() => undefined,
				() => undefined,
			);
		}
	}
}
