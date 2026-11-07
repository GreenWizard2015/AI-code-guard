import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessSpawnerContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _process spawn options_, _provider version probes_. **/
export class ReviewAgentProcessTestDriver implements ReviewAgentProcessSpawnerContract {
	private readonly _child: ReviewAgentChildProcessContract;
	private readonly _probes: { options: SpawnSyncOptionsWithStringEncoding; arguments_list: string[] }[];
	private readonly _spawn_options: SpawnOptions[];
	private readonly _probe_result: SpawnSyncReturns<string>;

	/** Responsibilities: _test process initialization_. **/
	public constructor(child: ReviewAgentChildProcessContract, probe_result: SpawnSyncReturns<string>) {
		this._child = child;
		this._probes = [];
		this._spawn_options = [];
		this._probe_result = probe_result;
	}

	/** Responsibilities: _process spawning_. **/
	public spawn_child(
		_command: string,
		_arguments_list: readonly string[],
		_options: SpawnOptions,
	): ReviewAgentChildProcessContract {
		this._spawn_options.push(_options);
		return this._child;
	}

	/** Responsibilities: _provider version probe_. **/
	public spawn_sync(
		_command: string,
		_arguments_list: readonly string[],
		options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string> {
		this._probes.push({ options, arguments_list: [..._arguments_list] });
		return this._probe_result;
	}

	/** Responsibilities: _provider probe observations_. **/
	public probe_snapshot(index: number): {
		timeout: number;
		cwd: string;
		input: string;
		arguments_list: readonly string[];
	} {
		const probe = this._probes[index];
		if (probe === undefined) {
			throw new RangeError(`No provider probe was recorded at index ${index}.`);
		}
		const timeout = probe.options.timeout;
		if (timeout === undefined) {
			throw new Error("The provider probe did not set a timeout.");
		}
		const cwd = probe.options.cwd;
		if (typeof cwd !== "string") {
			throw new Error("The provider probe did not use a string working directory.");
		}
		const input = probe.options.input;
		if (typeof input !== "string") {
			throw new Error("The provider probe did not provide string input.");
		}
		return { timeout, cwd, input, arguments_list: [...probe.arguments_list] };
	}

	/** Responsibilities: _spawn environment value observation_. **/
	public spawn_environment_value(index: number, key: string): string {
		const options = this._spawn_options[index];
		if (options === undefined) {
			throw new RangeError(`No child process was spawned at index ${index}.`);
		}
		const environment = options.env;
		if (environment === undefined) {
			throw new Error("The spawned child did not receive an environment.");
		}
		const environment_entries = Object.entries(environment);
		for (const [environment_key, value] of environment_entries) {
			if (environment_key !== key) {
				continue;
			}
			if (value === undefined) {
				throw new Error(`The spawned child environment did not contain ${key}.`);
			}
			return value;
		}
		throw new Error(`The spawned child environment did not contain ${key}.`);
	}
}
