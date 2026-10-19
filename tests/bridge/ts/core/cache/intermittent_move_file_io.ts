import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _move failure injection_, _recovery attempt_. **/
export class IntermittentMoveFileIO extends InMemoryFileIO {
	private remaining_failures: number;

	/** Responsibilities: _publication failure count initialization_. **/
	public constructor(failure_count: number) {
		super();
		this.remaining_failures = failure_count;
	}

	/** Responsibilities: _intermittent move failure simulation_. **/
	public move_file(source: string, destination: string): void {
		if (this.remaining_failures > 0) {
			this.remaining_failures -= 1;
			super.move_file(`${source}.missing`, destination);
			return;
		}
		super.move_file(source, destination);
	}
}
