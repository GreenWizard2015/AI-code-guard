import type { TemporalFieldReaderIndexContract } from "src/analysis_protocols";

/** Responsibilities: _temporal field reader ownership_, _reader lookup_. **/
export class TemporalFieldReaderIndex implements TemporalFieldReaderIndexContract {
	private readonly _readers_by_field: Map<string, number[]>;

	/** Responsibilities: _temporal reader index initialization_. **/
	public constructor() {
		this._readers_by_field = new Map<string, number[]>();
	}

	/** Responsibilities: _temporal field reader recording_. **/
	public add(field: string, callable_index: number): void {
		let readers = this._readers_by_field.get(field);
		if (readers === undefined) {
			readers = [];
		}
		readers.push(callable_index);
		this._readers_by_field.set(field, readers);
	}

	/** Responsibilities: _temporal field reader lookup_. **/
	public different_callable_reads(field: string, callable_index: number): boolean {
		const readers = this._readers_by_field.get(field);
		if (readers === undefined) {
			return false;
		}
		return readers.some((reader) => reader !== callable_index);
	}
}
