import { join } from "node:path";
import { DUNDER_TESTS_DIRECTORY_NAME } from "src/constants";
import { TEST_SCOPE_DIRECTORIES } from "src/constants";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TestPathCheckerContract } from "src/testing_protocols";

/** Responsibilities: _test path validation_, _module path derivation_. **/
export class TestFileOrganization {
	private readonly project_root: string;
	private readonly path_checker: TestPathCheckerContract;
	private readonly test_path_syntax: TestPathSyntax;
	private readonly test_scope_directories: ReadonlySet<string>;

	/** Responsibilities: _source module prefix_. **/
	private module_prefix(segments: string[], start: number, end: number): boolean {
		for (let length = 1; start + length <= end; length += 1) {
			if (this.source_directory(segments.slice(start, start + length))) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _checking optional scope directory_. **/
	private leading_scope_length(segments: string[]): number {
		let length = 0;
		while (length < segments.length) {
			const segment = segments[length];
			if (segment === undefined) {
				break;
			}
			if (!this.test_scope_directories.has(segment)) {
				break;
			}
			length += 1;
		}
		return length;
	}

	/** Responsibilities: _checking trailing scope directory_. **/
	private trailing_scope_length(segments: string[]): number {
		let length = 0;
		while (length < segments.length) {
			const index = segments.length - length - 1;
			const segment = segments[index];
			if (segment === undefined) {
				break;
			}
			if (!this.test_scope_directories.has(segment)) {
				break;
			}
			length += 1;
		}
		return length;
	}

	/** Responsibilities: _checking optional scope hierarchy_. **/
	private scoped_module(segments: string[]): boolean {
		if (segments.length < 2) {
			return false;
		}
		const leading_length = this.leading_scope_length(segments);
		if (leading_length > 0) {
			return this.module_prefix(segments, leading_length, segments.length);
		}
		const trailing_length = this.trailing_scope_length(segments);
		if (trailing_length > 0) {
			return this.module_prefix(segments, 0, segments.length - trailing_length);
		}
		return false;
	}

	/** Responsibilities: _validation runner test filename_. **/
	private supported_test_file(file: string, root: string): boolean {
		if (root === DUNDER_TESTS_DIRECTORY_NAME) {
			if (file.endsWith(".ts")) {
				return true;
			}
			return file.endsWith(".tsx");
		}
		return this.test_path_syntax.test_file_name(file);
	}

	/** Responsibilities: _test path structure_. **/
	private valid_structure(file: string, segments: string[]): boolean {
		if (segments.length < 3) {
			return false;
		}
		const root = segments.slice(0, 1).join("/");
		if (root !== "tests") {
			if (root !== DUNDER_TESTS_DIRECTORY_NAME) {
				return false;
			}
		}
		return this.supported_test_file(file, root);
	}

	/** Responsibilities: _test module structure_. **/
	private valid_module(segments: string[]): boolean {
		const module_segments = segments.slice(1, -1);
		if (this.module_prefix(module_segments, 0, module_segments.length)) {
			return true;
		}
		return this.scoped_module(module_segments);
	}

	/** Responsibilities: _initialization test path validation_. **/
	public constructor(project_root: string, path_checker: TestPathCheckerContract) {
		this.test_path_syntax = new TestPathSyntax();
		this.test_scope_directories = new Set(Object.values(TEST_SCOPE_DIRECTORIES).flat());
		this.project_root = project_root;
		this.path_checker = path_checker;
	}

	/** Responsibilities: _source package directory lookup_. **/
	public source_directory(segments: string[]): boolean {
		const root_path = join(this.project_root, ...segments);
		if (this.path_checker.directory(root_path)) {
			return true;
		}
		const source_path = join(this.project_root, "src", ...segments);
		if (this.path_checker.directory(source_path)) {
			return true;
		}
		for (const extension of [".ts", ".tsx", ".py", ".mjs"]) {
			if (this.path_checker.file(`${source_path}${extension}`)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _test module path candidates_. **/
	public module_paths(file: string): string[][] {
		const segments = file
			.replaceAll("\\", "/")
			.split("/")
			.filter((segment) => segment.length > 0);
		if (segments.length < 3) {
			return [[]];
		}
		const module_segments = segments.slice(1, -1);
		const leading_length = this.leading_scope_length(module_segments);
		const trailing_length = this.trailing_scope_length(module_segments);
		const canonical = module_segments.slice(leading_length, module_segments.length - trailing_length);
		const candidates = [canonical];
		if (leading_length > 0 || trailing_length > 0) {
			candidates.push(module_segments);
		}
		return candidates;
	}

	/** Responsibilities: _validation test file organization_. **/
	public valid(file: string): boolean {
		if (!this.test_path_syntax.test_file(file, true)) {
			return false;
		}
		const segments = file
			.split("\\")
			.join("/")
			.split("/")
			.filter((segment) => segment.length > 0);
		if (!this.valid_structure(file, segments)) {
			return false;
		}
		return this.valid_module(segments);
	}
}
