import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { CallableCachePublicationScheduledWrite } from "tests/bridge/ts/core/cache/types";

/** Responsibilities: _reentrant cache publication_, _temporary record queue_. **/
export class CachePublicationConcurrentWriterFileIO extends InMemoryFileIO {
	private readonly _scheduled_writes: CallableCachePublicationScheduledWrite[];
	private _completed_writes: number;

	/** Responsibilities: _nested publication queue_. **/
	public constructor() {
		super();
		this._scheduled_writes = [];
		this._completed_writes = 0;
	}

	/** Responsibilities: _nested cache publication_. **/
	public schedule_write(write: CallableCachePublicationScheduledWrite): void {
		this._scheduled_writes.push(write);
	}

	/** Responsibilities: _publication callback dispatch_. **/
	public override write_text(file: string, text: string): void {
		super.write_text(file, text);
		if (!file.endsWith(".tmp")) {
			return;
		}
		const scheduled_writes = this._scheduled_writes.splice(0);
		for (const write of scheduled_writes) {
			write();
			this._completed_writes += 1;
		}
	}

	/** Responsibilities: _publication tally_. **/
	public completed_write_count(): number {
		return this._completed_writes;
	}

	/** Responsibilities: _temporary file inventory_. **/
	public temporary_files(directory: string): string[] {
		return this.list_files(directory).filter((file) => file.endsWith(".tmp"));
	}
}
