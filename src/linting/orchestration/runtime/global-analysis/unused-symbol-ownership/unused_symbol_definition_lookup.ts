import type {
	UnusedSymbolDefinitionLookupContract,
	UnusedSymbolFileNameBucketsContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolFileNameBuckets } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_file_name_buckets";

/** Responsibilities: _file definition catalog_, _lazy name bucket cache_. **/
export class UnusedSymbolDefinitionLookup implements UnusedSymbolDefinitionLookupContract {
	private readonly _definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	private readonly _file_buckets: Map<string, UnusedSymbolFileNameBucketsContract>;

	/** Responsibilities: _project definition catalog initialization_. **/
	public constructor(definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>) {
		this._definitions_by_file = definitions_by_file;
		this._file_buckets = new Map<string, UnusedSymbolFileNameBucketsContract>();
	}

	/** Responsibilities: _file-scoped definition buckets_. **/
	public for_file(file: string): UnusedSymbolFileNameBucketsContract {
		const cached = this._file_buckets.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const bucket = new UnusedSymbolFileNameBuckets();
		for (const definition of this._definitions_by_file.get(file) ?? []) {
			bucket.add(definition);
		}
		this._file_buckets.set(file, bucket);
		return bucket;
	}
}
