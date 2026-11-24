import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import {
	FUNCTION_MODULE_NAMES,
	NODE_EXECUTABLE_SHEBANG,
	PYTHON_PACKAGE_SUFFIX,
	PYTHON_SOURCE_EXTENSION,
	SOURCE_EXTENSIONS,
	TEST_PATH_SUFFIXES,
} from "src/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import type { ProjectContextState, ProjectSourceOptions } from "src/model_types";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { ProjectSourceClassification, ProjectSourceEntryContract, ProjectSourcePath } from "src/source_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _entry point classification_, _project-relative path resolution_. **/
export class ProjectSourceEntry implements ProjectSourceEntryContract {
	protected readonly _root: string;
	private readonly _source_context_state: ProjectContextState;
	private readonly _entry_files: ReadonlySet<string>;
	private readonly _relative_paths: Map<string, string>;
	private readonly _python_ast_data: PythonAstData;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _Python executable entry classification_. **/
	private python_entry_point(absolute_path: string, relative_path: string): boolean {
		if (relative_path.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return true;
		}
		if (this._source_context_state.available) {
			return (
				this._source_context_state.value.source_record(absolute_path).normalized_ast.module_declarations
					.python_main_guard === true
			);
		}
		const python_text = readFileSync(absolute_path, "utf8");
		return this._python_ast_data.source_ast(python_text).module_declarations.python_main_guard === true;
	}

	/** Responsibilities: _JavaScript executable entry classification_. **/
	private javascript_entry_point(absolute_path: string, relative_path: string): boolean {
		if (!SOURCE_EXTENSIONS.has(extname(relative_path))) {
			return false;
		}
		let source_text = "";
		if (this._source_context_state.available) {
			source_text = this._source_context_state.value.source_record(absolute_path).text;
		} else {
			source_text = readFileSync(absolute_path, "utf8");
		}
		const first_line = source_text.split("\n", 1).at(0);
		return first_line !== undefined && first_line.replace("\r", "") === NODE_EXECUTABLE_SHEBANG;
	}

	/** Responsibilities: _project executable entry classification_. **/
	private source_entry_point(candidate: ProjectSourcePath): boolean {
		if (extname(candidate.relative) === PYTHON_SOURCE_EXTENSION) {
			return this.python_entry_point(candidate.absolute, candidate.relative);
		}
		return this.javascript_entry_point(candidate.absolute, candidate.relative);
	}

	/** Responsibilities: _project source initialization_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		const python_ast_bridge = new PythonAstBridge();
		const python_ast_options = python_ast_bridge.options();
		this._python_ast_data = new PythonAstData(python_ast_options);
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._root = root;
		this._source_context_state = options.context_state;
		this._entry_files = new Set(options.entry_files);
		this._relative_paths = new Map();
	}

	/** Responsibilities: _project source path creation_. **/
	public project_path(source_file_path: string): ProjectSourcePath {
		const cached = this._relative_paths.get(source_file_path);
		if (cached !== undefined) {
			return { absolute: source_file_path, relative: cached };
		}
		const path = relative(this._root, source_file_path).split("\\").join("/");
		const normalized = path || ".";
		this._relative_paths.set(source_file_path, normalized);
		return { absolute: source_file_path, relative: normalized };
	}

	/** Responsibilities: _project source role classification_. **/
	public classification(source: ProjectSourcePath): ProjectSourceClassification {
		const entry_point = this.source_entry_point(source) || this._entry_files.has(source.relative);
		const entry =
			FUNCTION_MODULE_NAMES.has(source.relative) ||
			entry_point ||
			this._test_path_syntax.classify(source.relative).has(TestPathKind.TestFile);
		return { entry, entry_point };
	}

	/** Responsibilities: _project entry-point file classification_. **/
	public configured_entries(source_files: readonly string[]): string[] {
		const entry_points: string[] = [];
		for (const file of source_files) {
			const source = this.project_path(file);
			if (this.classification(source).entry_point) {
				entry_points.push(file);
			}
		}
		return entry_points;
	}
}
