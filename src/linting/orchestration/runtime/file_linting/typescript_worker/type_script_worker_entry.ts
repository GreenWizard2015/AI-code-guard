import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { inspect } from "node:util";
import { deserialize } from "node:v8";
import { isMainThread, workerData } from "node:worker_threads";
import type { TypeScriptWorkerOutput, TypeScriptWorkerTimer } from "src/type_script_file_worker_pool_types";
import type {
	TypeScriptWorkerBootstrapInput,
	TypeScriptWorkerInput,
	TypeScriptWorkerParseSnapshot,
} from "src/typescript_file_worker_types";
import type TypeScriptModule from "typescript";

/** Responsibilities: _worker job execution_, _worker IPC delivery_. **/
export class TypeScriptWorkerEntry {
	private readonly _input: TypeScriptWorkerInput;

	/** Responsibilities: _source AST parser worker_. **/
	private parse_sources(ts: typeof TypeScriptModule): number {
		for (const source of this._input.snapshot.sources) {
			let kind = ts.ScriptKind.TS;
			if (source.file.endsWith(".tsx")) {
				kind = ts.ScriptKind.TSX;
			}
			ts.createSourceFile(source.file, source.text, ts.ScriptTarget.Latest, false, kind);
		}
		return this._input.files.length;
	}

	/** Responsibilities: _worker timing measurements_. **/
	private worker_timers(started_ms: number, finished_ms: number): TypeScriptWorkerTimer[] {
		const enqueued_ms = this._input.snapshot.enqueued_at_ms;
		const shard_name = this._input.files[0] ?? "empty";
		const queue_ms = Math.max(0, started_ms - enqueued_ms);
		const parse_ms = finished_ms - started_ms;
		return [
			{ name: `typescript.worker.shard.${shard_name}.queue`, duration_ms: queue_ms },
			{ name: `typescript.worker.shard.${shard_name}.parse`, duration_ms: parse_ms },
			{ name: `typescript.worker.shard.${shard_name}.completion`, duration_ms: finished_ms - enqueued_ms },
		];
	}

	/** Responsibilities: _worker analysis result_. **/
	private successful_output(): TypeScriptWorkerOutput {
		const started_ms = performance.timeOrigin + performance.now();
		const ts: typeof TypeScriptModule = createRequire(import.meta.url)(this._input.typescript_module_name);
		const parsed_files = this.parse_sources(ts);
		const finished_ms = performance.timeOrigin + performance.now();
		return {
			ok: true,
			parsed_files,
			violations: [],
			timers: this.worker_timers(started_ms, finished_ms),
			error: "",
			stack: "",
		};
	}

	/** Responsibilities: _worker error stack resolution_. **/
	/** Responsibilities: _worker failure details_. **/
	private failed_output(stack: string): TypeScriptWorkerOutput {
		return {
			ok: false,
			parsed_files: 0,
			violations: [],
			timers: [],
			error: "TypeScript worker execution failed.",
			stack,
		};
	}

	/** Responsibilities: _worker result dispatch_. **/
	private output(): TypeScriptWorkerOutput {
		try {
			return this.successful_output();
		} catch (error) {
			return this.failed_output(inspect(error));
		}
	}

	/** Responsibilities: _worker entry initialization_. **/
	public constructor(input: TypeScriptWorkerInput) {
		this._input = input;
	}

	/** Responsibilities: _worker completion signaling_, _worker result delivery_. **/
	public deliver(output: TypeScriptWorkerOutput): void {
		this._input.port.postMessage(output);
		const control = new Int32Array(this._input.control);
		Atomics.store(control, 0, 1);
		Atomics.notify(control, 0);
		this._input.port.close();
	}

	/** Responsibilities: _worker analysis dispatch_. **/
	public run(): void {
		this.deliver(this.output());
	}
}

if (!isMainThread) {
	(() => {
		const input: TypeScriptWorkerBootstrapInput = workerData;
		input.port.once("message", (encoded: Uint8Array) => {
			const snapshot: TypeScriptWorkerParseSnapshot = deserialize(encoded);
			const worker_input: TypeScriptWorkerInput = {
				files: input.files,
				control: input.control,
				port: input.port,
				typescript_module_name: input.typescript_module_name,
				snapshot,
			};
			const entry = new TypeScriptWorkerEntry(worker_input);
			entry.run();
		});
	})();
}
