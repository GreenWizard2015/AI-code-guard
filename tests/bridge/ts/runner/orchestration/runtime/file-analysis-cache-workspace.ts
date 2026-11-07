import { dirname, join } from "node:path";
import type { GlobalAnalysisCacheOptions } from "src/cache_types";
import type { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

/** Responsibilities: _cache fixture source state_, _cache operation access_. **/
export class FileAnalysisCacheWorkspace {
	private readonly _temporary_write_paths: Set<string>;
	public readonly _root: string;
	public readonly _file: string;
	public readonly _typescript_config_file: string;
	public readonly _text: string;
	public readonly _file_io: AstDiskCacheFixture["_file_io"];
	public readonly _source_texts: Map<string, string>;
	public readonly _source_io: InMemoryProjectSourceIO;
	public readonly _analysis_identity: AstDiskCacheFixture["_identity"];
	public readonly _record: LintSourceRecordData;
	public readonly _violation: ViolationContract;

	/** Responsibilities: _cache fixture source ownership_. **/
	public constructor(
		root: string,
		file_io: AstDiskCacheFixture["_file_io"],
		analysis_identity: AstDiskCacheFixture["_identity"],
		source_texts: Map<string, string>,
		source_io: InMemoryProjectSourceIO,
		record: LintSourceRecordData,
		violation: ViolationContract,
	) {
		this._temporary_write_paths = new Set();
		this._root = root;
		this._file = join(root, "module.ts");
		this._typescript_config_file = join(root, "tsconfig.json");
		this._text = "export const value = 1;\n";
		this._file_io = file_io;
		this._source_texts = source_texts;
		this._source_io = source_io;
		this._analysis_identity = analysis_identity;
		this._record = record;
		this._violation = violation;
	}

	/** Responsibilities: _virtual source file mutation_. **/
	public write_source(file: string, text: string): void {
		this._file_io.create_directory(dirname(file));
		this._file_io.file(file).write_text(text);
		this._source_texts.set(file, text);
	}

	/** Responsibilities: _global cache options_. **/
	public global_cache_options(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: readonly string[],
	): GlobalAnalysisCacheOptions {
		return {
			repo_root: this._root,
			records: [this._record],
			files,
			ignored_files,
			entry_files,
			identity: this._analysis_identity,
			context_identity: this._analysis_identity.context([this._record]),
			file_io: this._file_io,
			source_io: this._source_io,
			temporary_write_paths: this._temporary_write_paths,
		};
	}

	/** Responsibilities: _cached diagnostic corruption_. **/
	public corrupt_cache(directory_name: string): boolean {
		const directory = join(this._root, ".ai-code-guard", "cache", directory_name);
		for (const name of this._file_io.list_files(directory)) {
			const path = join(directory, name);
			const serialized_record = this._file_io.file(path).file_text();
			const malformed_record = serialized_record.replace(/,"priority":\d+/u, "");
			if (malformed_record === serialized_record) {
				return false;
			}
			this._file_io.file(path).write_text(malformed_record);
			return true;
		}
		return false;
	}

	/** Responsibilities: _cached null diagnostic injection_. **/
	public corrupt_with_null_diagnostic(directory_name: string): boolean {
		const directory = join(this._root, ".ai-code-guard", "cache", directory_name);
		for (const name of this._file_io.list_files(directory)) {
			const path = join(directory, name);
			const serialized_record = this._file_io.file(path).file_text();
			const malformed_record = serialized_record.replace('"violations":[', '"violations":[null,');
			if (malformed_record === serialized_record) {
				return false;
			}
			this._file_io.file(path).write_text(malformed_record);
			return true;
		}
		return false;
	}
}
