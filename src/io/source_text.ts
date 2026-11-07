import { join } from "node:path";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _source text access_, _source line endings normalization_. **/
export class SourceText implements ProjectSourceIOContract {
	private readonly _file_io: IOContract;

	/** Responsibilities: _recursive source path collection_. **/
	private append_paths(directory: string, paths: string[], ignored_directories: ReadonlySet<string>): void {
		for (const entry of this._file_io.list_entries(directory)) {
			const path = join(directory, entry.name);
			if (entry.is_directory) {
				if (!ignored_directories.has(entry.name)) {
					this.append_paths(path, paths, ignored_directories);
				}
				continue;
			}
			if (entry.is_file) {
				paths.push(path);
			}
		}
	}

	/** Responsibilities: _project source adapter setup_. **/
	public constructor() {
		this._file_io = new NodeFileIO(process.cwd());
	}

	/** Responsibilities: _source path inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		const paths: string[] = [];
		this.append_paths(root, paths, ignored_directories);
		return paths;
	}

	/** Responsibilities: _output normalization source text_. **/
	public source_text(file: string): string {
		const normalized_file = file.trim();
		if (!normalized_file) {
			throw new Error("Source file path is required.");
		}
		const source = this._file_io.file(normalized_file).file_text();
		if (!source.includes("\r")) {
			return source;
		}
		return source.replace(/\r\n?/g, "\n");
	}

	/** Responsibilities: _source file availability_. **/
	public source_available(file: string): boolean {
		const normalized_file = file.trim();
		if (!normalized_file) {
			return false;
		}
		return this._file_io.path_is_file(normalized_file);
	}
}
