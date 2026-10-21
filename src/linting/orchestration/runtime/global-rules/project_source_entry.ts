import { relative } from "node:path";
import { readFileSync } from "node:fs";
import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { TestPathSyntax } from "src/test_path_syntax";
import type { ProjectContextState, ProjectSourceOptions } from "src/model/types/types";
import type { ProjectSourceEntryContract } from "src/source_protocols";
import { FUNCTION_MODULE_NAMES, PYTHON_PACKAGE_SUFFIX } from "src/constants";

/** Responsibilities: _entry point classification_, _project-relative path resolution_. **/
export class ProjectSourceEntry implements ProjectSourceEntryContract {
	protected readonly root: string;
	private readonly source_context_state: ProjectContextState;
	private readonly entry_files: ReadonlySet<string>;
	private readonly python_ast_data: PythonAstData;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _classification Python path entry_. **/
	private python_entry(file: string, path: string): boolean {
		if (!path.endsWith(".py")) {
			return false;
		}
		if (path.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return true;
		}
		if (!this.source_context_state.available) {
			return this.python_ast_data.source_ast(readFileSync(file, "utf8")).python_main_guard === true;
		}
		return this.source_context_state.value.source_record(file).normalized_ast.python_main_guard === true;
	}

	/** Responsibilities: _classification Node TypeScript path_. **/
	private node_entry(file: string, path: string): boolean {
		if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
			return false;
		}
		let text: string;
		if (this.source_context_state.available) {
			text = this.source_context_state.value.source_record(file).text;
		} else {
			text = readFileSync(file, "utf8");
		}
		const lines = text.split("\n", 1);
		const first_line = lines[0].replace("\r", "");
		return first_line === "#!/usr/bin/env node";
	}

	/** Responsibilities: _initialization project root source-discovery_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		this.python_ast_data = new PythonAstData(new PythonAstBridge());
		this.test_path_syntax = new TestPathSyntax();
		this.root = root;
		this.source_context_state = options.context_state;
		this.entry_files = new Set(options.entry_files);
	}

	/** Responsibilities: _normalization source file path_. **/
	public relative_path(file: string): string {
		const path = relative(this.root, file).split("\\").join("/");
		if (!path) {
			return ".";
		}
		return path;
	}

	/** Responsibilities: _reporting file project entry_. **/
	public entry(file: string): boolean {
		const path = this.relative_path(file);
		if (FUNCTION_MODULE_NAMES.has(path)) {
			return true;
		}
		if (this.python_entry(file, path) || this.node_entry(file, path)) {
			return true;
		}
		if (this.entry_files.has(path)) {
			return true;
		}
		return this.test_path_syntax.test_file(path);
	}
}
