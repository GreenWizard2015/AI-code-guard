import {
	DUNDER_TESTS_DIRECTORY_FRAGMENT,
	DUNDER_TESTS_DIRECTORY_PREFIX,
	FUNCTION_MODULE_NAMES,
	PYTHON_TEST_SUFFIXES,
	TESTS_DIRECTORY_FRAGMENT,
	TESTS_DIRECTORY_PREFIX,
	TYPESCRIPT_TEST_SUFFIXES,
} from "src/constants";
import { PYTHON_LANGUAGE, PYTHON_SOURCE_EXTENSION, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { LintFileNameContract } from "src/core/support/protocols";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _path normalization_, _test-path identity_. **/
export class LintFileName implements LintFileNameContract {
	private readonly _path_value: string;
	private readonly _functions_file_value: boolean;

	/** Responsibilities: _test path classification_. **/
	private tests_directory(): boolean {
		if (this._path_value.startsWith(TESTS_DIRECTORY_PREFIX)) {
			return true;
		}
		if (this._path_value.includes(TESTS_DIRECTORY_FRAGMENT)) {
			return true;
		}
		if (this._path_value.startsWith(DUNDER_TESTS_DIRECTORY_PREFIX)) {
			return true;
		}
		return this._path_value.includes(DUNDER_TESTS_DIRECTORY_FRAGMENT);
	}

	/** Responsibilities: _file-name suffix classification_. **/
	private is_test_suffix(): boolean {
		const file_name = this._path_value.slice(this._path_value.lastIndexOf("/") + 1);
		if (file_name.startsWith("test_") && file_name.endsWith(".py")) {
			return true;
		}
		if (TYPESCRIPT_TEST_SUFFIXES.some((suffix) => this._path_value.endsWith(suffix))) {
			return true;
		}
		return PYTHON_TEST_SUFFIXES.some((suffix) => this._path_value.endsWith(suffix));
	}

	/** Responsibilities: _file path normalization_. **/
	public constructor(file: string) {
		this._path_value = file.split("\\").join("/");
		this._functions_file_value = FUNCTION_MODULE_NAMES.has(this._path_value);
	}

	/** Responsibilities: _path value access_. **/
	public value(): string {
		return this._path_value;
	}

	/** Responsibilities: _functions-file classification_. **/
	public functions_file(): boolean {
		return this._functions_file_value;
	}

	/** Responsibilities: _test file classification_. **/
	public test(): boolean {
		if (this.tests_directory()) {
			return true;
		}
		if (this.is_test_suffix()) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _production file classification_. **/
	public product(): boolean {
		if (this.tests_directory()) {
			return false;
		}
		if (this.is_test_suffix()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _source language classification_. **/
	public language(): AstLanguage {
		if (this._path_value.toLowerCase().endsWith(PYTHON_SOURCE_EXTENSION)) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}
}
