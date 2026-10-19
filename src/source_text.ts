import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _source text access_, _source line endings normalization_. **/
export class SourceText implements ProjectSourceIOContract {
	private readonly encoding = "utf8";

	/** Responsibilities: _recursive source path collection_. **/
	private append_paths(directory: string, paths: string[], ignored_directories: ReadonlySet<string>): void {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!ignored_directories.has(entry.name)) {
					this.append_paths(path, paths, ignored_directories);
				}
				continue;
			}
			if (entry.isFile()) {
				paths.push(path);
			}
		}
	}

	/** Responsibilities: _validation source file path_. **/
	private validated_file(file: string): string {
		const normalized_file = file.trim();
		if (!normalized_file) {
			throw new Error("Source file path is required.");
		}
		return normalized_file;
	}

	/** Responsibilities: _output normalization source text_. **/
	private read_source(file: string): string {
		const source = readFileSync(this.validated_file(file), this.encoding);
		if (!source.includes("\r")) {
			return source;
		}
		return source.replace(/\r\n?/g, "\n");
	}

	/** Responsibilities: _source path inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		const paths: string[] = [];
		this.append_paths(root, paths, ignored_directories);
		return paths;
	}

	/** Responsibilities: _output normalization source text_. **/
	public source_text(file: string): string {
		return this.source_lines(file).join("\n");
	}

	/** Responsibilities: _source file availability_. **/
	public source_available(file: string): boolean {
		try {
			return statSync(this.validated_file(file)).isFile();
		} catch (error) {
			void error;
			return false;
		}
	}

	/** Responsibilities: _output normalization source lines_. **/
	public source_lines(file: string): string[] {
		return this.read_source(file).split("\n");
	}
}
