import { PythonAstData } from "src/core/python-ast/python_ast_data";
import type { LintRunWorkerLifecycleOptions, LintRunWorkerSessionState } from "src/core/types";
import type {
	PythonAstDataContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";
import type { LintRunWorkerLifecycleContract } from "src/runtime_protocols";

/** Responsibilities: _active Python worker session_, _parser recovery_. **/
export class LintRunWorkerLifecycle implements LintRunWorkerLifecycleContract {
	private readonly _options: LintRunWorkerLifecycleOptions;
	private readonly _session_state_key: symbol;
	private readonly _session_states: Map<symbol, LintRunWorkerSessionState>;

	/** Responsibilities: _fresh session parser composition_. **/
	private open_session(): LintRunWorkerSessionState {
		const session = this._options.registry.worker_session(this._options.worker_arguments, this._options.worker_options);
		const worker = session.worker();
		const parser = new PythonAstData({
			worker: worker,
			analysis_identity: this._options.analysis_identity,
			split_batch_enabled: true,
			file_io: this._options.file_io,
			cache_enabled: this._options.cache_enabled,
		});
		return { session, worker, parser };
	}

	/** Responsibilities: _current worker session state_. **/
	private active_session_state(): LintRunWorkerSessionState {
		const current_state = this._session_states.get(this._session_state_key);
		if (current_state !== undefined) {
			return current_state;
		}
		const initial_state = this.open_session();
		this._session_states.set(this._session_state_key, initial_state);
		return initial_state;
	}

	/** Responsibilities: _worker lifecycle dependencies_. **/
	public constructor(options: LintRunWorkerLifecycleOptions) {
		this._options = options;
		this._session_state_key = Symbol("active-worker-session");
		this._session_states = new Map();
	}

	/** Responsibilities: _initial worker session publication_. **/
	public start_session(): void {
		if (this._session_states.has(this._session_state_key)) {
			return;
		}
		this._session_states.set(this._session_state_key, this.open_session());
	}

	/** Responsibilities: _inactive lease recovery_. **/
	public ensure_active(): void {
		const current_state = this.active_session_state();
		if (current_state.session.active()) {
			return;
		}
		this._session_states.set(this._session_state_key, this.open_session());
	}

	/** Responsibilities: _worker session access_. **/
	public session(): PythonAstWorkerSessionContract {
		return this.active_session_state().session;
	}

	/** Responsibilities: _worker capability access_. **/
	public worker(): PythonAstWorkerCapabilityContract {
		return this.active_session_state().worker;
	}

	/** Responsibilities: _worker parser access_. **/
	public parser(): PythonAstDataContract {
		return this.active_session_state().parser;
	}
}
