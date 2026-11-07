import type { ProcessKillContract } from "src/analysis_protocols";

/** Responsibilities: _process operation outcomes_, _signal observations_. **/
export class ProcessSignalProbe implements ProcessKillContract {
	private readonly _denies_group_signals: boolean;
	private readonly _signals: { readonly pid: number; readonly signal: number }[];

	/** Responsibilities: _process signal probe initialization_. **/
	public constructor(denies_group_signals: boolean) {
		this._denies_group_signals = denies_group_signals;
		this._signals = [];
	}

	/** Responsibilities: _process signal outcomes_. **/
	public kill(pid: number, signal: number): boolean {
		this._signals.push({ pid, signal });
		return !this._denies_group_signals || pid >= 0;
	}

	/** Responsibilities: _process signal observations_. **/
	public observations(): readonly { readonly pid: number; readonly signal: number }[] {
		return this._signals;
	}
}
