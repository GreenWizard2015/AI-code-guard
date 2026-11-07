import type { DocumentationExamplePathContract } from "documentation_validation/protocols";
import { PythonCapabilityPolicy } from "documentation_validation/sandbox/python/python_capability_policy";
import { PythonImportPolicy } from "documentation_validation/sandbox/python/python_import_policy";
import { PythonModuleGraph } from "documentation_validation/sandbox/python/python_module_graph";
import type { DocumentationExampleSourceFile, DocumentationExampleSourceFiles } from "documentation_validation/types";

/** Responsibilities: _Python source safety_, _module import validation_, _example output policy_. **/
export class PythonExamplePolicy {
	private readonly _modules: PythonModuleGraph;
	private readonly _capabilities: PythonCapabilityPolicy;

	/** Responsibilities: _reachable source safety validation_. **/
	private source_safety_issues(sources: DocumentationExampleSourceFiles, entry: string): string[] {
		const source = sources.map(({ text }) => text).join("\n");
		const entry_source = sources.find(({ path }) => path === entry);
		const issues: string[] = [];
		issues.push(...this._capabilities.unsafe_operation_issues(source));
		if (this._capabilities.uses_reflective_access(source)) {
			issues.push("runtime introspection access is not allowed");
		}
		issues.push(...this.module_output_issues(sources, entry));
		if (entry_source !== undefined) {
			issues.push(...this.cli_output_issues(entry_source));
		}
		return [...new Set(issues)];
	}

	/** Responsibilities: _import-time Python output detection_. **/
	private line_indentation(line: string): number {
		const indentation = /^\s*/u.exec(line);
		if (indentation === null) {
			return 0;
		}
		return indentation[0].length;
	}

	/** Responsibilities: _callable indentation tracking_. **/
	private next_callable_indentation(line: string, indentation: number, current: number): number {
		let next = current;
		if (indentation <= current) {
			next = -1;
		}
		if (/^(?:async\s+)?def\s+[A-Za-z_]\w*\s*\(/u.test(line.trimStart())) {
			return indentation;
		}
		return next;
	}

	/** Responsibilities: _top-level Python output detection_. **/
	private top_level_output(text: string): boolean {
		let callable_indentation = -1;
		for (const line of text.split("\n")) {
			const indentation = this.line_indentation(line);
			callable_indentation = this.next_callable_indentation(line, indentation, callable_indentation);
			if (callable_indentation < 0 && /^print\s*\(/u.test(line.trimStart())) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _module output validation_. **/
	private module_output_issues(sources: readonly DocumentationExampleSourceFile[], entry: string): string[] {
		const issues: string[] = [];
		for (const source of sources) {
			if (source.path !== entry && this.top_level_output(source.text)) {
				issues.push(`${source.path}: imported modules must write output from a called function or method`);
			}
		}
		return issues;
	}

	/** Responsibilities: _CLI output validation_. **/
	private cli_output_issues(entry_source: DocumentationExampleSourceFile): string[] {
		if (/\b(?:print|stdout|stderr)\b/u.test(entry_source.text)) {
			return [`${entry_source.path}: CLI entrypoints must not write output`];
		}
		return [];
	}

	/** Responsibilities: _Python validation dependencies_. **/
	public constructor(source_files: ReadonlyMap<string, string>) {
		this._modules = new PythonModuleGraph(source_files);
		this._capabilities = new PythonCapabilityPolicy();
	}

	/** Responsibilities: _source import diagnostics_. **/
	public import_issues(sources: DocumentationExampleSourceFiles): string[] {
		const source_modules = this._modules.module_names();
		const imports = new PythonImportPolicy(source_modules);
		return imports.issues(sources);
	}

	/** Responsibilities: _reachable Python safety diagnostics_. **/
	public safety_issues(path: DocumentationExamplePathContract): string[] {
		const entry = path.entry_file();
		const sources = this._modules.reachable_sources(path.test_files(), entry);
		const issues = this.import_issues(sources);
		issues.push(...this.source_safety_issues(sources, entry));
		return [...new Set(issues)];
	}
}
