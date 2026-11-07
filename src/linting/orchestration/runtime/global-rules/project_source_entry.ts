import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { FUNCTION_MODULE_NAMES, PYTHON_PACKAGE_SUFFIX, SOURCE_EXTENSIONS } from "src/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import type { ProjectContextState, ProjectSourceOptions } from "src/model_types";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { ProjectSourceEntryContract, ProjectSourcePath } from "src/source_protocols";
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

	/** Responsibilities: _project source text access_. **/
	private source_text(absolute_path: string): string {
		if (this._source_context_state.available) {
			return this._source_context_state.value.source_record(absolute_path).text;
		}
		return readFileSync(absolute_path, "utf8");
	}

	/** Responsibilities: _classification Python path entry_. **/
	private python_entry(source: ProjectSourcePath): boolean {
		const { absolute, relative: path } = source;
		if (!path.endsWith(".py")) {
			return false;
		}
		if (path.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return true;
		}
		if (!this._source_context_state.available) {
			return (
				this._python_ast_data.source_ast(this.source_text(absolute)).module_declarations.python_main_guard === true
			);
		}
		return (
			this._source_context_state.value.source_record(absolute).normalized_ast.module_declarations.python_main_guard ===
			true
		);
	}

	/** Responsibilities: _TypeScript entry classification_. **/
	private node_entry(source: ProjectSourcePath): boolean {
		const extension = extname(source.relative);
		if (extension === ".py") {
			return false;
		}
		if (!SOURCE_EXTENSIONS.has(extension)) {
			return false;
		}
		const text = this.source_text(source.absolute);
		const first_line = text.split("\n", 1).at(0);
		if (first_line === undefined) {
			return false;
		}
		return first_line.replace("\r", "") === "#!/usr/bin/env node";
	}

	/** Responsibilities: _initialization project root source-discovery_. **/
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

	/** Responsibilities: _normalization source file path_. **/
	public relative_path(file: string): string {
		const cached = this._relative_paths.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const path = relative(this._root, file).split("\\").join("/");
		let normalized = path;
		if (!normalized) {
			normalized = ".";
		}
		this._relative_paths.set(file, normalized);
		return normalized;
	}

	/** Responsibilities: _reporting file project entry_. **/
	public entry(file: string): boolean {
		const path = this.relative_path(file);
		const source = { absolute: file, relative: path };
		if (FUNCTION_MODULE_NAMES.has(path)) {
			return true;
		}
		const runtime_entry = this.python_entry(source) || this.node_entry(source);
		const cli_entry = /^cli\.(?:ts|tsx|mts|cts|py)$/u.test(path.slice(path.lastIndexOf("/") + 1));
		if (runtime_entry || cli_entry) {
			return true;
		}
		if (this._entry_files.has(path)) {
			return true;
		}
		return this._test_path_syntax.classify(path).has(TestPathKind.TestFile);
	}
}
