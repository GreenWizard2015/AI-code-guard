import type { AstCallableReference } from 'src/types';
import type { ParsedFile, SharedCallableKind } from 'src/metrics/types';

/** Responsibilities: _indexing callable references file_. **/
export class CallableReferenceIndex {
	private readonly files_by_callable = new Map<string, ParsedFile[]>();

	/** Responsibilities: _file callable addition parsing_. **/
	private append_file(key: string, file: ParsedFile): void {
		let files = this.files_by_callable.get(key);
		if (files === undefined) {
			files = [];
			this.files_by_callable.set(key, files);
		}
		files.push(file);
	}

	/** Responsibilities: _retrieval normalization callable references_. **/
	private references(file: ParsedFile): readonly AstCallableReference[] {
		const references = file.ast.call_references;
		if (references === undefined) {
			return [];
		}
		return references;
	}

	/** Responsibilities: _indexing callable references parsing_. **/
	public index_files(files: readonly ParsedFile[]): void {
		for (const file of files) {
			const seen_keys = new Set<string>();
			for (const reference of this.references(file)) {
				const key = `${reference.kind}:${reference.name}`;
				if (seen_keys.has(key)) {
					continue;
				}
				seen_keys.add(key);
				this.append_file(key, file);
			}
		}
	}

	/** Responsibilities: _output files containing callable_. **/
	public files_for(kind: SharedCallableKind, name: string): readonly ParsedFile[] {
		const files = this.files_by_callable.get(`${kind}:${name}`);
		if (files === undefined) {
			return [];
		}
		return files;
	}

	/** Responsibilities: _reporting callable kind name_. **/
	public callable(kind: SharedCallableKind, name: string): boolean {
		return this.files_by_callable.has(`${kind}:${name}`);
	}
}
