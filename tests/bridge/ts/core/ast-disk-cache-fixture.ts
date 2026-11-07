import { dirname, join, resolve } from "node:path";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type { AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ANALYZER_FILES_V1 } from "tests/bridge/ts/core/constants";

/** Responsibilities: _cache directory_, _analyzer source snapshot_. **/
export class AstDiskCacheFixture {
	public readonly _root: string;
	public readonly _analyzer_root: string;
	public readonly _file_io: InMemoryFileIO;
	public readonly _identity: ProjectAnalysisIdentity;

	/** Responsibilities: _analyzer source snapshot creation_. **/
	private analyzer_source_files(root: string): ReadonlyMap<string, string> {
		const files = new Map<string, string>();
		for (const [path, text] of Object.entries(ANALYZER_FILES_V1)) {
			files.set(resolve(root, path), text);
		}
		return files;
	}

	/** Responsibilities: _virtual analyzer project construction_. **/
	public constructor(file_io: InMemoryFileIO, project_name = "ast-cache") {
		const root = resolve("/virtual", project_name);
		this._root = root;
		this._analyzer_root = join(root, "analyzer");
		this._file_io = file_io;
		this._file_io.seed_files(this.analyzer_source_files(root));
		this._identity = new ProjectAnalysisIdentity(this._file_io, this._analyzer_root);
	}

	/** Responsibilities: _virtual project path construction_. **/
	public path(file: string): string {
		return resolve(this._root, file);
	}

	/** Responsibilities: _virtual file publication_. **/
	public write(file: string, text: string): void {
		const absolute_file = resolve(file);
		this._file_io.create_directory(dirname(absolute_file));
		this._file_io.file(absolute_file).write_text(text);
	}

	/** Responsibilities: _cache record initialization_. **/
	public cache_for(
		source_file: string,
		source_text: string,
		language: AstLanguage,
		ast: NormalizedAstFile,
	): AstDiskCache {
		this.write(source_file, source_text);
		const cache = new AstDiskCache(this._root, "project-a", this._identity, language, this._file_io);
		cache.write(source_file, source_text, ast);
		return cache;
	}

	/** Responsibilities: _cache record location_. **/
	public cache_record_path(language: AstLanguage): string {
		const directory = join(this._root, ".ai-code-guard", "cache", "ast", language);
		return this.only_file(directory);
	}

	/** Responsibilities: _single cache record path_. **/
	public only_file(directory: string): string {
		const files = this._file_io.list_files(directory);
		if (files.length !== 1) {
			throw new Error(`Expected one cache record in ${directory}.`);
		}
		for (const file of files) {
			return join(directory, file);
		}
		throw new Error(`Cache record is missing in ${directory}.`);
	}
}
