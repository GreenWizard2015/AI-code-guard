import { dirname, join } from "node:path";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { GlobalAnalysisCacheOptions } from "src/cache_types";
import type { LintSourceRecord } from "src/source_types";
import { ViolationValue } from "src/violation_value";
import type { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

/** Responsibilities: _cache fixture source state_, _cache operation access_. **/
export class FileAnalysisCacheWorkspace {
	public readonly root: string;
	public readonly file: string;
	public readonly typescript_config_file: string;
	public readonly text: string;
	public readonly file_io: AstDiskCacheFixture["file_io"];
	public readonly source_texts: Map<string, string>;
	public readonly source_io: InMemoryProjectSourceIO;
	public readonly analysis_identity: AstDiskCacheFixture["identity"];
	public readonly record: LintSourceRecord;
	public readonly violation: ViolationValue;

	/** Responsibilities: _cache fixture source ownership_. **/
	public constructor(
		root: string,
		file_io: AstDiskCacheFixture["file_io"],
		analysis_identity: AstDiskCacheFixture["identity"],
		source_texts: Map<string, string>,
		source_io: InMemoryProjectSourceIO,
		record: LintSourceRecord,
		violation: ViolationValue,
	) {
		this.root = root;
		this.file = join(root, "module.ts");
		this.typescript_config_file = join(root, "tsconfig.json");
		this.text = "export const value = 1;\n";
		this.file_io = file_io;
		this.source_texts = source_texts;
		this.source_io = source_io;
		this.analysis_identity = analysis_identity;
		this.record = record;
		this.violation = violation;
	}

	/** Responsibilities: _virtual source file mutation_. **/
	public write_source(file: string, text: string): void {
		this.file_io.directory_operations.create_directory(dirname(file));
		this.file_io.file_content.write_text(file, text);
		this.source_texts.set(file, text);
	}

	/** Responsibilities: _global cache options_. **/
	public global_cache_options(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: readonly string[],
	): GlobalAnalysisCacheOptions {
		return {
			repo_root: this.root,
			records: [this.record],
			files,
			ignored_files,
			entry_files,
			identity: this.analysis_identity,
			file_io: this.file_io,
			source_io: this.source_io,
		};
	}

	/** Responsibilities: _cached diagnostic corruption_. **/
	public corrupt_cache(directory_name: string): boolean {
		const directory = join(this.root, ".ai-code-guard", "cache", directory_name);
		const [name] = this.file_io.directory_entries.list_files(directory);
		if (name === undefined) {
			return false;
		}
		const path = join(directory, name);
		const record = JSON.parse(this.file_io.file_content.file_text(path));
		const first_violation = record.violations[0];
		const { priority: _priority, ...malformed_violation } = first_violation;
		record.violations[0] = malformed_violation;
		this.file_io.file_content.write_text(path, JSON.stringify(record));
		return true;
	}
}
