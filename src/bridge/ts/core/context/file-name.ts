import { PYTHON_TEST_SUFFIXES, TYPESCRIPT_TEST_SUFFIXES } from "src/constants";

/** Responsibilities: _classification lint paths tests_. **/
export class LintFileName {
	public readonly value: string;
	public readonly is_functions_file: boolean;

	/** Responsibilities: _classification file inside tests_. **/
	private is_tests_directory(): boolean {
		if (this.value.startsWith("tests/")) {
			return true;
		}
		if (this.value.includes("/tests/")) {
			return true;
		}
		if (this.value.startsWith("__tests__/")) {
			return true;
		}
		return this.value.includes("/__tests__/");
	}

	/** Responsibilities: _file-name suffix classification_. **/
	private is_test_suffix(): boolean {
		const file_name = this.value.slice(this.value.lastIndexOf("/") + 1);
		if (file_name.startsWith("test_")) {
			if (file_name.endsWith(".py")) {
				return true;
			}
		}
		if (TYPESCRIPT_TEST_SUFFIXES.some((suffix) => this.value.endsWith(suffix))) {
			return true;
		}
		return PYTHON_TEST_SUFFIXES.some((suffix) => this.value.endsWith(suffix));
	}

	/** Responsibilities: _initialization normalization file path_. **/
	public constructor(file: string) {
		this.value = file.split("\\").join("/");
		this.is_functions_file =
			this.value === "functions.ts" || this.value === "functions.tsx" || this.value === "functions.py";
	}

	/** Responsibilities: _reporting file test file_. **/
	public test(): boolean {
		if (this.is_tests_directory()) {
			return true;
		}
		if (this.is_test_suffix()) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _reporting file production source_. **/
	public product(): boolean {
		if (this.is_tests_directory()) {
			return false;
		}
		if (this.is_test_suffix()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _reporting file Python test_. **/
	public test_py(): boolean {
		const file_name = this.value.slice(this.value.lastIndexOf("/") + 1);
		if (file_name.startsWith("test_")) {
			return file_name.endsWith(".py");
		}
		return PYTHON_TEST_SUFFIXES.some((suffix) => this.value.endsWith(suffix));
	}
}
