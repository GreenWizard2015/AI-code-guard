import {
	PYTHON_EXTENSION,
	PYTHON_TEST_SUFFIX,
	TEST_DIRECTORY,
	TYPESCRIPT_EXTENSION,
	TYPESCRIPT_TEST_SUFFIX,
} from "#documentation_validation/constants";
import { DUNDER_TESTS_DIRECTORY_NAME, DUNDER_TESTS_DIRECTORY_PREFIX } from "src/constants";
import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";
import type { DocumentationExample } from "#documentation_validation/types";

/** Responsibilities: _documentation source selection_, _example module path derivation_. **/
export class DocumentationExamplePath {
	private readonly example: DocumentationExample;

	/** Responsibilities: _explicit test source recognition_. **/
	private test_source_file(path: string): boolean {
		const segments = path.split("/");
		const file_name = segments[segments.length - 1];
		if (file_name === undefined) {
			return false;
		}
		if (this.example.language === DocumentationLanguage.PYTHON) {
			return /^test_.*\.py$/u.test(file_name) || /_test\.py$/u.test(file_name);
		}
		if (segments.includes(DUNDER_TESTS_DIRECTORY_NAME)) {
			return /\.tsx?$/u.test(file_name);
		}
		return /\.(?:test|spec)\.tsx?$/u.test(file_name);
	}

	/** Responsibilities: _explicit test fixture selection_. **/
	private explicit_test_file(): string {
		for (const file of this.example.source_files) {
			if (file.path.startsWith(`${TEST_DIRECTORY}/`) || file.path.startsWith(DUNDER_TESTS_DIRECTORY_PREFIX)) {
				return file.path;
			}
		}
		for (const file of this.example.source_files) {
			if (this.test_source_file(file.path)) {
				return file.path;
			}
		}
		return "";
	}

	/** Responsibilities: _production source file selection_. **/
	private production_source_file(): string {
		let fallback_path = "";
		for (const file of this.example.source_files) {
			if (file.path.startsWith(`${TEST_DIRECTORY}/`)) {
				continue;
			}
			if (fallback_path.length === 0) {
				fallback_path = file.path;
			}
			if (!this.cli_file(file.path)) {
				return file.path;
			}
		}
		return fallback_path;
	}

	/** Responsibilities: _TypeScript protocol examples_. **/
	private typescript_protocol_only(text: string): boolean {
		const has_protocol = /^(?:export\s+)?interface\s+/mu.test(text);
		const has_implementation = /^(?:export\s+)?(?:class|function|const|let|var|type|enum|namespace)\b/mu.test(text);
		return has_protocol && !has_implementation;
	}

	/** Responsibilities: _Python protocol examples_. **/
	private python_protocol_only(text: string): boolean {
		const protocol_pattern = /^class\s+\w+\s*\([^)]*\bProtocol\b[^)]*\)\s*:/gmu;
		const class_pattern = /^class\s+\w+/gmu;
		const protocols = [...text.matchAll(protocol_pattern)];
		const classes = [...text.matchAll(class_pattern)];
		if (protocols.length === 0 || protocols.length !== classes.length) {
			return false;
		}
		return !/^def\s+\w+\s*\(/mu.test(text);
	}

	/** Responsibilities: _protocol file choice_. **/
	private protocol_only(): boolean {
		if (this.example.language === DocumentationLanguage.TYPESCRIPT) {
			return this.typescript_protocol_only(this.example.text);
		}
		return this.python_protocol_only(this.example.text);
	}

	/** Responsibilities: _test source recognition_. **/
	private test_example(): boolean {
		if (this.example.language === DocumentationLanguage.PYTHON) {
			const unittest_test = /^class\s+Test\w*\s*\([^)]*TestCase[^)]*\)\s*:/mu.test(this.example.text);
			const pytest_test = /^def\s+test_\w+\s*\(/mu.test(this.example.text);
			return unittest_test || pytest_test;
		}
		return /\b(?:test|it|describe)\s*\(/u.test(this.example.text);
	}

	/** Responsibilities: _CLI entry file classification_. **/
	private cli_file(path: string): boolean {
		const path_segments = path.split("/");
		const file_name = path_segments[path_segments.length - 1];
		switch (file_name) {
			case "cli.ts":
			case "cli.py":
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _class declaration count_. **/
	private single_class_name(): string {
		let pattern = /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gmu;
		if (this.example.language === DocumentationLanguage.PYTHON) {
			pattern = /^class\s+([A-Za-z_]\w*)/gmu;
		}
		let declaration_count = 0;
		let class_name = "";
		this.example.text.replace(pattern, (_: string, captured_name: string) => {
			declaration_count += 1;
			class_name = captured_name;
			return "";
		});
		if (declaration_count !== 1) {
			return "";
		}
		return class_name;
	}

	/** Responsibilities: _class source path_. **/
	private class_source_path(extension: string, directory: string): string {
		const class_name = this.single_class_name();
		if (class_name.length === 0) {
			return `${directory}/example${extension}`;
		}
		const file_name = class_name
			.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2")
			.replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
			.toLowerCase();
		return `${directory}/${file_name}${extension}`;
	}

	/** Responsibilities: _source extension choice_. **/
	private extension(): string {
		if (this.example.language === DocumentationLanguage.PYTHON) {
			return PYTHON_EXTENSION;
		}
		return TYPESCRIPT_EXTENSION;
	}

	/** Responsibilities: _fallback implementation source path_. **/
	private fallback_source_path(extension: string, directory: string): string {
		if (this.example.kind === ExampleKind.GOOD) {
			if (this.protocol_only()) {
				return `${directory}/protocols${extension}`;
			}
		}
		if (this.example.kind === ExampleKind.BAD) {
			return `${directory}/example${extension}`;
		}
		return this.class_source_path(extension, directory);
	}

	/** Responsibilities: _example path inputs_. **/
	public constructor(example: DocumentationExample) {
		this.example = example;
	}

	/** Responsibilities: _production example source path_. **/
	public source_path(): string {
		const source_file = this.production_source_file();
		if (source_file.length > 0) {
			return source_file;
		}
		if (this.test_example()) {
			return this.test_path();
		}
		const extension = this.extension();
		const directory = `src/documentation/${this.example.rule_id}`;
		return this.fallback_source_path(extension, directory);
	}

	/** Responsibilities: _test example source path_. **/
	public test_path(): string {
		const test_file = this.explicit_test_file();
		if (test_file.length > 0) {
			return test_file;
		}
		let suffix = TYPESCRIPT_TEST_SUFFIX;
		if (this.example.language === DocumentationLanguage.PYTHON) {
			suffix = PYTHON_TEST_SUFFIX;
		}
		return `${TEST_DIRECTORY}/documentation/${this.example.rule_id}/example${suffix}`;
	}

	/** Responsibilities: _example analysis source selection_. **/
	public analysis_path(): string {
		const test_file = this.explicit_test_file();
		if (test_file.length > 0) {
			return test_file;
		}
		return this.source_path();
	}
}
