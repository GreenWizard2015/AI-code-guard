import { PythonModuleImportTarget } from "documentation_validation/python_module_import_target";
import type { DocumentationExampleSourceFile } from "documentation_validation/types";

/** Responsibilities: _Python source import graph_, _import security diagnostics_. **/
export class PythonSourceImports {
	private readonly _source: DocumentationExampleSourceFile;
	private readonly _source_modules: ReadonlySet<string>;
	private readonly _current_module: string;
	private readonly _imported_module_names: Set<string>;

	/** Responsibilities: _import name collection_. **/
	private collect_from_import(line: string): void {
		const imported = /(?:^|[;:])\s*from\s+([.\w]+)\s+import\b/u.exec(line);
		if (imported === null) {
			return;
		}
		const module_name = imported[1];
		if (module_name !== undefined) {
			this._imported_module_names.add(module_name);
		}
	}

	/** Responsibilities: _alias-aware import parsing_. **/
	private collect_import_list(line: string): void {
		const imported = /(?:^|[;:])\s*import\s+([\w.,\s]+)/u.exec(line);
		if (imported === null) {
			return;
		}
		const module_list = imported[1];
		if (module_list === undefined) {
			return;
		}
		for (const declaration of module_list.split(",")) {
			const module_name = declaration.trim().replace(/\s+as\s+.*$/u, "");
			this._imported_module_names.add(module_name);
		}
	}

	/** Responsibilities: _static import collection_. **/
	private collect_static_imports(): void {
		for (const line of this._source.text.split("\n")) {
			this.collect_from_import(line);
			this.collect_import_list(line);
		}
	}

	/** Responsibilities: _static import diagnostics_. **/
	private static_import_issues(): string[] {
		const issues: string[] = [];
		for (const module_name of this._imported_module_names) {
			const target = new PythonModuleImportTarget(module_name, this._current_module, this._source_modules);
			if (!target.allowed()) {
				issues.push(`${module_name}: external module access is not allowed`);
			}
		}
		return issues;
	}

	/** Responsibilities: _dynamic import validation_. **/
	private dynamic_import_issues(): string[] {
		const dynamic_import = /\bimportlib\s*\.\s*import_module\s*\(\s*(['"])([^'"]+)\1\s*\)/u.exec(this._source.text);
		if (dynamic_import === null) {
			return [];
		}
		const module_name = dynamic_import[2];
		if (module_name !== undefined && !this._source_modules.has(module_name)) {
			return [`${module_name}: dynamic imports must target an example source module`];
		}
		return [];
	}

	/** Responsibilities: _source ownership_, _module catalog reference_. **/
	public constructor(source: DocumentationExampleSourceFile, source_modules: ReadonlySet<string>) {
		this._source = source;
		this._source_modules = source_modules;
		this._current_module = source.path
			.slice(0, -3)
			.replaceAll("/", ".")
			.replace(/\.__init__$/u, "");
		this._imported_module_names = new Set<string>();
	}

	/** Responsibilities: _source import policy_. **/
	public issues(): string[] {
		this.collect_static_imports();
		const issues = new Set([...this.static_import_issues(), ...this.dynamic_import_issues()]);
		return [...issues];
	}

	/** Responsibilities: _source module dependencies_. **/
	public imported_modules(): string[] {
		this.collect_static_imports();
		return [...this._imported_module_names];
	}
}
