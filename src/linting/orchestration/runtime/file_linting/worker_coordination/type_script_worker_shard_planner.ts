/** Responsibilities: _TypeScript worker count_, _minimum-sized file shards_. **/
export class TypeScriptWorkerShardPlanner {
	private readonly _minimum_shard_size: number;
	private readonly _maximum_workers: number;

	/** Responsibilities: _initial shard size_. **/
	private initial_shard_size(index: number, base_size: number, remainder: number): number {
		let shard_size = base_size;
		if (index < remainder) {
			shard_size += 1;
		}
		return shard_size;
	}

	/** Responsibilities: _main-thread workload transfer_. **/
	private transferred_file_count(first_size: number, last_size: number, shard_count: number): number {
		if (shard_count < 2) {
			return 0;
		}
		const available_files = Math.max(0, last_size - this._minimum_shard_size);
		return Math.min(Math.floor(first_size / 10), available_files);
	}

	/** Responsibilities: _weighted shard size_. **/
	private weighted_shard_size(
		index: number,
		base_size: number,
		remainder: number,
		is_last_shard: boolean,
		transferred_files: number,
	): number {
		let shard_size = this.initial_shard_size(index, base_size, remainder);
		if (index === 0) {
			shard_size += transferred_files;
		}
		if (is_last_shard) {
			shard_size -= transferred_files;
		}
		return shard_size;
	}

	/** Responsibilities: _complete weighted shard sizes_. **/
	private shard_sizes(file_count: number, shard_count: number): number[] {
		const base_size = Math.floor(file_count / shard_count);
		const remainder = file_count % shard_count;
		const first_size = this.initial_shard_size(0, base_size, remainder);
		const last_size = this.initial_shard_size(shard_count - 1, base_size, remainder);
		const transferred = this.transferred_file_count(first_size, last_size, shard_count);
		return Array.from({ length: shard_count }, (_, index) =>
			this.weighted_shard_size(index, base_size, remainder, index === shard_count - 1, transferred),
		);
	}

	/** Responsibilities: _worker pool limits_. **/
	public constructor(minimum_shard_size = 200, maximum_workers = 4) {
		this._minimum_shard_size = minimum_shard_size;
		this._maximum_workers = maximum_workers;
	}

	/** Responsibilities: _worker count selection_. **/
	public worker_count(file_count: number): number {
		if (file_count < this._minimum_shard_size) {
			return 0;
		}
		return Math.min(this._maximum_workers, Math.floor(file_count / this._minimum_shard_size));
	}

	/** Responsibilities: _balanced file shard creation_. **/
	public shards<T>(files: readonly T[]): T[][] {
		const worker_count = this.worker_count(files.length);
		if (worker_count === 0) {
			return [];
		}
		const sizes = this.shard_sizes(files.length, worker_count);
		const shards: T[][] = [];
		let start = 0;
		for (const size of sizes) {
			shards.push(files.slice(start, start + size));
			start += size;
		}
		return shards;
	}
}
