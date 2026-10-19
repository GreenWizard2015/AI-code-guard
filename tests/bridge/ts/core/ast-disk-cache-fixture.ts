import { dirname, join, resolve } from "node:path";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ANALYZER_FILES_V1 } from "tests/bridge/ts/core/constants";

/** Responsibilities: _cache directory_, _analyzer source snapshot_. **/
export class AstDiskCacheFixture {
	public readonly root: string;
	public readonly analyzer_root: string;
	public readonly file_io: InMemoryFileIO;
	public readonly identity: ProjectAnalysisIdentity;

	/** Responsibilities: _analyzer source snapshot creation_. **/
	private analyzer_source_files(root: string): ReadonlyMap<string, string> {
		const files = new Map<string, string>();
		for (const [path, text] of Object.entries(ANALYZER_FILES_V1)) {
			files.set(resolve(root, path), text);
		}
		return files;
	}

	/** Responsibilities: _virtual analyzer project construction_. **/
	public constructor(project_name = "ast-cache") {
		const root = resolve("/virtual", project_name);
		this.root = root;
		this.analyzer_root = join(root, "analyzer");
		this.file_io = new InMemoryFileIO();
		const file_io = this.file_io;
		file_io.seed_files(this.analyzer_source_files(root));
		this.identity = new ProjectAnalysisIdentity(this.file_io, this.analyzer_root);
	}

	/** Responsibilities: _virtual project path construction_. **/
	public path(file: string): string {
		return resolve(this.root, file);
	}

	/** Responsibilities: _virtual file publication_. **/
	public write(file: string, text: string): void {
		const absolute_file = resolve(file);
		this.file_io.directory_operations.create_directory(dirname(absolute_file));
		this.file_io.file_content.write_text(absolute_file, text);
	}

	/** Responsibilities: _single cache record path_. **/
	public only_file(directory: string): string {
		const files = this.file_io.directory_entries.list_files(directory);
		if (files.length !== 1) {
			throw new Error(`Expected one cache record in ${directory}.`);
		}
		for (const file of files) {
			return join(directory, file);
		}
		throw new Error(`Cache record is missing in ${directory}.`);
	}
}
