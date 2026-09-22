import { readFileSync } from 'node:fs';

/** Responsibilities: _source text access_, _source line endings normalization_. **/
export class SourceText {
	private readonly encoding = 'utf8';

	/** Responsibilities: _validation source file path_. **/
	private validated_file(file: string): string {
		const normalized_file = file.trim();
		if (!normalized_file) {
			throw new Error('Source file path is required.');
		}
		return normalized_file;
	}

	/** Responsibilities: _source file normalization_. **/
	private read_source(file: string): string {
		const source = readFileSync(this.validated_file(file), this.encoding);
		if (!source.includes('\r')) {
			return source;
		}
		return source.replace(/\r\n?/g, '\n');
	}

	/** Responsibilities: _output normalization source text_. **/
	public source_text(file: string): string {
		return this.source_lines(file).join('\n');
	}

	/** Responsibilities: _output normalization source lines_. **/
	public source_lines(file: string): string[] {
		return this.read_source(file).split('\n');
	}
}
