import { PythonSourceImports } from "documentation_validation/python_source_imports";
import type { DocumentationExampleSourceFile } from "documentation_validation/types";

/** Responsibilities: _Python import policy_, _source module catalog_. **/
export class PythonImportPolicy {
	private readonly _modules: ReadonlySet<string>;

	/** Responsibilities: _known Python source modules_. **/
	public constructor(modules: ReadonlySet<string>) {
		this._modules = modules;
	}

	/** Responsibilities: _source module catalog access_. **/
	public source_modules(): ReadonlySet<string> {
		return this._modules;
	}

	/** Responsibilities: _Python import diagnostics_. **/
	public issues(sources: readonly DocumentationExampleSourceFile[]): string[] {
		const issues = new Set<string>();
		for (const source of sources) {
			const analysis = new PythonSourceImports(source, this.source_modules());
			for (const issue of analysis.issues()) {
				issues.add(issue);
			}
		}
		return [...issues];
	}
}
