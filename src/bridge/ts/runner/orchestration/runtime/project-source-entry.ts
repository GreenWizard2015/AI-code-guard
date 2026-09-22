import { relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import type { ProjectContextState, ProjectSourceOptions } from 'src/bridge/ts/runner/types';

/** Responsibilities: _classification Python Node project_. **/
export class ProjectSourceEntry {
	protected readonly root: string;
	private readonly source_context_state: ProjectContextState;
	private readonly entry_files: ReadonlySet<string>;
	private readonly python_ast_data = new PythonAstData();

	/** Responsibilities: _classification Python path entry_. **/
	private python_entry(file: string, path: string): boolean {
		if (!path.endsWith('.py')) {
			return false;
		}
		if (path.endsWith('/__init__.py')) {
			return true;
		}
		if (!this.source_context_state.available) {
			return this.python_ast_data.source_ast(readFileSync(file, 'utf8')).python_main_guard === true;
		}
		return this.source_context_state.value.source_record(file).normalized_ast.python_main_guard === true;
	}

	/** Responsibilities: _classification Node TypeScript path_. **/
	private node_entry(file: string, path: string): boolean {
		if (!path.endsWith('.ts') && !path.endsWith('.tsx')) {
			return false;
		}
		let text: string;
		if (this.source_context_state.available) {
			text = this.source_context_state.value.source_record(file).text;
		} else {
			text = readFileSync(file, 'utf8');
		}
		return text.split('\n', 1)[0].replace('\r', '') === '#!/usr/bin/env node';
	}

	/** Responsibilities: _initialization project root source-discovery_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		this.root = root;
		this.source_context_state = options.context_state;
		this.entry_files = new Set(options.entry_files);
	}

	/** Responsibilities: _exposure configuration project context_. **/
	public get context_state(): ProjectContextState {
		return this.source_context_state;
	}

	/** Responsibilities: _normalization source file path_. **/
	public relative_path(file: string): string {
		const path = relative(this.root, file).split('\\').join('/');
		if (!path) {
			return '.';
		}
		return path;
	}

	/** Responsibilities: _reporting file project entry_. **/
	public entry(file: string): boolean {
		const path = this.relative_path(file);
		if (['functions.ts', 'functions.tsx', 'functions.py'].includes(path)) {
			return true;
		}
if (this.python_entry(file, path) || this.node_entry(file, path)) {
			return true;
		}
		if (this.entry_files.has(path)) {
			return true;
		}
		return /.(test|spec)\.(tsx?|py)$/u.test(path);
	}
}
