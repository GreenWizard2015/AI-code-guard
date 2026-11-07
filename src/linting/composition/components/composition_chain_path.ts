import type { CompositionChainPathOptions, CompositionChainPathState } from "src/contracts/types/composition_types";

/** Responsibilities: _composition chain reconstruction_, _cycle-safe path traversal_. **/
export class CompositionChainPath {
	private readonly _options: CompositionChainPathOptions;
	private readonly _state: CompositionChainPathState;

	/** Responsibilities: _composition path continuation_. **/
	private continue_from(current_key: string): boolean {
		let next_key = this._options.local_next_keys.get(current_key);
		if (next_key === undefined) {
			next_key = this._options.memo_next_keys.get(current_key);
		}
		if (next_key === undefined) {
			this._state.done = true;
			return false;
		}
		this._state.current_key = next_key;
		return true;
	}

	/** Responsibilities: _composition path initialization_. **/
	public constructor(options: CompositionChainPathOptions) {
		this._options = options;
		this._state = { current_key: options.root_key, done: false, names: [], visited: new Set<string>() };
	}

	/** Responsibilities: _composition chain advancement_. **/
	public advance(): boolean {
		if (this._state.done) {
			return false;
		}
		const current_key = this._state.current_key;
		const node = this._options.classes.get(current_key);
		if (node === undefined) {
			this._state.done = true;
			return false;
		}
		this._state.names.push(node.name);
		if (this._state.visited.has(current_key)) {
			this._state.done = true;
			return false;
		}
		this._state.visited.add(current_key);
		return this.continue_from(current_key);
	}

	/** Responsibilities: _composition chain names_. **/
	public names(): string[] {
		for (;;) {
			if (!this.advance()) {
				return this._state.names;
			}
		}
	}
}
