import type { SpawnOptions } from "node:child_process";
import { AstModel } from "src/core/ast_model";
import { PYTHON_AST_WORKER_REGISTRIES } from "src/core/python-ast/constants";
import type { PythonAstWorkerRegistryEntry } from "src/core/python-ast/types";
import { PythonCacheWorker } from "tests/bridge/ts/core/python-cache-worker";
import type { PythonAstWorkerLeaseFixtureState } from "tests/bridge/ts/core/types";

/** Responsibilities: _in-memory worker registry setup_, _lease fixture cleanup_. **/
export class PythonAstWorkerLeaseFixture {
	private readonly _arguments_list: string[];
	private readonly _options: SpawnOptions;
	private readonly _key: string;
	private readonly _worker: PythonCacheWorker;
	private readonly _registry_entries: Map<string, PythonAstWorkerRegistryEntry>;

	/** Responsibilities: _fixture state initialization_. **/
	public constructor(scenario: string) {
		const arguments_list = ["in-memory-worker", scenario];
		const options = { cwd: `/virtual/${scenario}` };
		const key = JSON.stringify([arguments_list, options]);
		const ast_model = new AstModel("python");
		const worker = new PythonCacheWorker(ast_model.empty_ast_file());
		const registry_entries = new Map(PYTHON_AST_WORKER_REGISTRIES.get(process) ?? []);
		registry_entries.set(key, { worker, leases: new Set<string>() });
		PYTHON_AST_WORKER_REGISTRIES.set(process, registry_entries);
		this._arguments_list = arguments_list;
		this._options = options;
		this._key = key;
		this._worker = worker;
		this._registry_entries = registry_entries;
	}

	/** Responsibilities: _fixture state access_. **/
	public state(): PythonAstWorkerLeaseFixtureState {
		return {
			arguments_list: this._arguments_list,
			options: this._options,
			key: this._key,
			worker: this._worker,
			registry_entries: this._registry_entries,
		};
	}

	/** Responsibilities: _test registry entry cleanup_. **/
	public cleanup(): void {
		this._registry_entries.delete(this._key);
	}
}
