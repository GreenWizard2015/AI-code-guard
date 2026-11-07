import { join } from "node:path";
import { DUNDER_TESTS_DIRECTORY_NAME } from "src/constants";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { TestFileOrganizationPathContract, TestPathCheckerContract } from "src/testing_protocols";
import { TestPathKind } from "src/types";

/** Responsibilities: _test file structure_, _test module path derivation_. **/
export class TestFileOrganizationPath implements TestFileOrganizationPathContract {
	private readonly _project_root: string;
	private readonly _path_checker: TestPathCheckerContract;
	private readonly _file: string;
	private readonly _file_segments: string[];
	private readonly _module_segments: string[];
	private readonly _root: string;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _test_scope_directories: ReadonlySet<string>;

	/** Responsibilities: _source module prefix_. **/
	private module_prefix(start: number, end: number): boolean {
		for (let length = 1; start + length <= end; length += 1) {
			if (this.source_directory(this._module_segments.slice(start, start + length))) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _optional scope directory length_. **/
	private leading_scope_length(): number {
		let length = 0;
		while (length < this._module_segments.length) {
			const segment = this._module_segments[length];
			if (segment === undefined || !this._test_scope_directories.has(segment)) {
				break;
			}
			length += 1;
		}
		return length;
	}

	/** Responsibilities: _trailing scope directory length_. **/
	private trailing_scope_length(): number {
		let length = 0;
		while (length < this._module_segments.length) {
			const index = this._module_segments.length - length - 1;
			const segment = this._module_segments[index];
			if (segment === undefined || !this._test_scope_directories.has(segment)) {
				break;
			}
			length += 1;
		}
		return length;
	}

	/** Responsibilities: _scoped module path_. **/
	private scoped_module(): boolean {
		if (this._module_segments.length < 2) {
			return false;
		}
		const leading_length = this.leading_scope_length();
		if (leading_length > 0) {
			return this.module_prefix(leading_length, this._module_segments.length);
		}
		const trailing_length = this.trailing_scope_length();
		if (trailing_length > 0) {
			return this.module_prefix(0, this._module_segments.length - trailing_length);
		}
		return false;
	}

	/** Responsibilities: _supported test filename_. **/
	private supported_test_file(): boolean {
		if (this._root === DUNDER_TESTS_DIRECTORY_NAME) {
			return this._file.endsWith(".ts") || this._file.endsWith(".tsx");
		}
		return this._test_path_syntax.classify(this._file).has(TestPathKind.TestFileName);
	}

	/** Responsibilities: _test path structure_. **/
	private valid_structure(): boolean {
		if (this._file_segments.length < 3) {
			return false;
		}
		if (this._root !== "tests" && this._root !== DUNDER_TESTS_DIRECTORY_NAME) {
			return false;
		}
		return this.supported_test_file();
	}

	/** Responsibilities: _source package directory lookup_. **/
	private source_directory(source_module_segments: string[]): boolean {
		const root_path = join(this._project_root, ...source_module_segments);
		if (this._path_checker.directory(root_path)) {
			return true;
		}
		const source_path = join(this._project_root, "src", ...source_module_segments);
		if (this._path_checker.directory(source_path)) {
			return true;
		}
		for (const extension of [".ts", ".tsx", ".py", ".mjs"]) {
			if (this._path_checker.file(`${source_path}${extension}`)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _test file path initialization_. **/
	public constructor(
		project_root: string,
		path_checker: TestPathCheckerContract,
		file: string,
		test_path_syntax: TestPathSyntaxContract,
		test_scope_directories: ReadonlySet<string>,
	) {
		this._project_root = project_root;
		this._path_checker = path_checker;
		this._file = file;
		this._file_segments = file
			.replaceAll("\\", "/")
			.split("/")
			.filter((segment) => segment.length > 0);
		this._module_segments = this._file_segments.slice(1, -1);
		const root = this._file_segments[0];
		this._root = "";
		if (root !== undefined) {
			this._root = root;
		}
		this._test_path_syntax = test_path_syntax;
		this._test_scope_directories = test_scope_directories;
	}

	/** Responsibilities: _test module path candidates_. **/
	public module_paths(): string[][] {
		if (this._file_segments.length < 3) {
			return [[]];
		}
		const leading_length = this.leading_scope_length();
		const trailing_length = this.trailing_scope_length();
		const canonical = this._module_segments.slice(leading_length, this._module_segments.length - trailing_length);
		const candidates = [canonical];
		if (leading_length > 0 || trailing_length > 0) {
			candidates.push(this._module_segments);
		}
		return candidates;
	}

	/** Responsibilities: _validation test file organization_. **/
	public valid(): boolean {
		if (!this._test_path_syntax.classify(this._file).has(TestPathKind.RootTestsFile)) {
			return false;
		}
		if (!this.valid_structure()) {
			return false;
		}
		if (this.module_prefix(0, this._module_segments.length)) {
			return true;
		}
		return this.scoped_module();
	}
}
