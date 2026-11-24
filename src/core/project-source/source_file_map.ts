import type { SourceFileMapContract, SourceFileResolverContract } from "src/core/project-source/types";
import type ts from "typescript";

/** Responsibilities: _source file collection_, _source file lookup_. **/
export class SourceFileMap implements SourceFileResolverContract {
	private readonly _source_files: SourceFileMapContract;

	/** Responsibilities: _source map initialization_. **/
	public constructor(source_files: SourceFileMapContract) {
		this._source_files = source_files;
	}

	/** Responsibilities: _source file lookup_. **/
	public source_file(file: string): ts.SourceFile {
		const source_file = this._source_files.get(file);
		if (source_file === undefined) {
			throw new Error(`No TypeScript source file is mapped at ${file}`);
		}
		return source_file;
	}

	/** Responsibilities: _source file presence_. **/
	public contains_source_file(file: string): boolean {
		if (file.length === 0) {
			return false;
		}
		return this._source_files.has(file);
	}
}
