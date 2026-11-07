import {
	DUNDER_TESTS_DIRECTORY_FRAGMENT,
	DUNDER_TESTS_DIRECTORY_PREFIX,
	TESTS_DIRECTORY_FRAGMENT,
	TESTS_DIRECTORY_PREFIX,
} from "src/constants";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { TestPathSuffixes } from "src/testing_protocols";
import { TestPathKind } from "src/types";

/** Responsibilities: _test path classification_, _language-specific test file detection_. **/
export class TestPathSyntax implements TestPathSyntaxContract {
	private readonly _suffixes: TestPathSuffixes;

	/** Responsibilities: _Python test filename_. **/
	private standard_python_test(file_name: string): boolean {
		if (file_name.startsWith("test_") && file_name.endsWith(".py")) {
			return true;
		}
		return this._suffixes.python.some((suffix) => file_name.endsWith(suffix));
	}

	/** Responsibilities: _test filename classification_. **/
	private classify_test_filename(file_name: string, kinds: Set<TestPathKind>): void {
		const configured_test_file = this._suffixes.test_file.some((suffix) => file_name.endsWith(suffix));
		if (configured_test_file || this.standard_python_test(file_name)) {
			kinds.add(TestPathKind.TestFileName);
			kinds.add(TestPathKind.TestFile);
		}
		if (this._suffixes.typescript.some((suffix) => file_name.endsWith(suffix))) {
			kinds.add(TestPathKind.TypeScriptTestFile);
		}
	}

	/** Responsibilities: _test directory classification_. **/
	private classify_test_directory(normalized_path: string, kinds: Set<TestPathKind>): void {
		const root_test_directory =
			normalized_path.startsWith(TESTS_DIRECTORY_PREFIX) || normalized_path.startsWith(DUNDER_TESTS_DIRECTORY_PREFIX);
		const nested_test_directory =
			normalized_path.includes(TESTS_DIRECTORY_FRAGMENT) || normalized_path.includes(DUNDER_TESTS_DIRECTORY_FRAGMENT);
		const in_test_directory = root_test_directory || nested_test_directory;
		if (in_test_directory) {
			kinds.add(TestPathKind.TestFile);
			kinds.add(TestPathKind.TypeScriptTestFile);
		}
		if (root_test_directory) {
			kinds.add(TestPathKind.RootTestsFile);
		}
	}

	/** Responsibilities: _test path categories_. **/
	private classify_normalized_path(normalized: string): ReadonlySet<TestPathKind> {
		const file_name = normalized.slice(normalized.lastIndexOf("/") + 1);
		const kinds = new Set<TestPathKind>();
		this.classify_test_filename(file_name, kinds);
		this.classify_test_directory(normalized, kinds);
		return kinds;
	}

	/** Responsibilities: _test path policy ownership_. **/
	public constructor(suffixes: TestPathSuffixes) {
		this._suffixes = suffixes;
	}

	/** Responsibilities: _test path classification_. **/
	public classify(file: string): ReadonlySet<TestPathKind> {
		const normalized = file.split("\\").join("/");
		return this.classify_normalized_path(normalized);
	}
}
