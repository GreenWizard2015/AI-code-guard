import { resolve } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _read-count tracking_, _file text interception_. **/
export class AstDiskCacheReadCountingFileIO extends InMemoryFileIO {
	private readonly _file_reads: Map<string, number>;

	/** Responsibilities: _counter map initialization_. **/
	public constructor() {
		super();
		this._file_reads = new Map<string, number>();
	}

	/** Responsibilities: _read-count accounting_. **/
	public override file_text(file: string): string {
		const path = resolve(file);
		this._file_reads.set(path, (this._file_reads.get(path) ?? 0) + 1);
		return super.file_text(file);
	}

	/** Responsibilities: _read-count reset_. **/
	public reset_file_reads(): void {
		this._file_reads.clear();
	}

	/** Responsibilities: _file access counts_. **/
	public file_read_count(file: string): number {
		return this._file_reads.get(resolve(file)) ?? 0;
	}
}
