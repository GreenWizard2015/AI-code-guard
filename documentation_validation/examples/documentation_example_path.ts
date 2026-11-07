import { PYTHON_EXTENSION, TEST_DIRECTORY, TYPESCRIPT_EXTENSION } from "documentation_validation/constants";
import type { DocumentationExamplePathContract } from "documentation_validation/protocols";
import { DocumentationLanguage } from "documentation_validation/types";
import type { DocumentationExample, DocumentationExampleSourceFiles } from "documentation_validation/types";
import { DUNDER_TESTS_DIRECTORY_NAME } from "src/constants";

/** Responsibilities: _example source records_, _virtual module metadata_. **/
export class DocumentationExamplePath implements DocumentationExamplePathContract {
	private readonly _example: DocumentationExample;

	/** Responsibilities: _test source filename classification_. **/
	private test_source_file(path: string): boolean {
		const segments = path.split("/");
		const file_name = segments.at(-1);
		if (file_name === undefined) {
			return false;
		}
		if (this._example.language === DocumentationLanguage.PYTHON) {
			return /^test_.*\.py$/u.test(file_name) || /_test\.py$/u.test(file_name);
		}
		if (segments.includes(DUNDER_TESTS_DIRECTORY_NAME)) {
			return /\.tsx?$/u.test(file_name);
		}
		return /\.(?:test|spec)\.tsx?$/u.test(file_name);
	}

	/** Responsibilities: _source example initialization_. **/
	public constructor(example: DocumentationExample) {
		this._example = example;
	}

	/** Responsibilities: _source record selection_. **/
	public source_files(): DocumentationExampleSourceFiles {
		return this._example.source_files;
	}

	/** Responsibilities: _virtual source map construction_. **/
	public source_map(): ReadonlyMap<string, string> {
		const sources = new Map<string, string>();
		for (const source of this._example.source_files) {
			sources.set(source.path, source.text);
		}
		if (sources.size === 0) {
			let extension = TYPESCRIPT_EXTENSION;
			if (this._example.language === DocumentationLanguage.PYTHON) {
				extension = PYTHON_EXTENSION;
			}
			sources.set(`cli${extension}`, this._example.text);
		}
		return sources;
	}

	/** Responsibilities: _example language identity_. **/
	public language(): DocumentationLanguage {
		return this._example.language;
	}

	/** Responsibilities: _primary example source text_. **/
	public source_text(): string {
		return this._example.text;
	}

	/** Responsibilities: _runnable entry file selection_. **/
	public entry_file(): string {
		let suffix = "cli.ts";
		if (this._example.language === DocumentationLanguage.PYTHON) {
			suffix = "cli.py";
		}
		for (const file of this._example.source_files) {
			const file_name = file.path.slice(file.path.lastIndexOf("/") + 1);
			if (file_name === suffix) {
				return file.path;
			}
		}
		throw new Error(`Runnable example requires a ${suffix} source file.`);
	}

	/** Responsibilities: _runnable test source selection_. **/
	public test_files(): readonly string[] {
		const files: string[] = [];
		for (const file of this._example.source_files) {
			const is_test_path = file.path.split("/").includes(TEST_DIRECTORY);
			if (is_test_path && this.test_source_file(file.path)) {
				files.push(file.path);
			}
		}
		return files;
	}
}
