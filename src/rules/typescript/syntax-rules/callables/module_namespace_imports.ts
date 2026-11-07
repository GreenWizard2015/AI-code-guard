import type { SourceFileStringSetCache } from "src/source_types";
import type { ModuleNamespaceImportsContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _module namespace imports_, _module dependency lookup_. **/
export class ModuleNamespaceImports implements ModuleNamespaceImportsContract {
	private readonly _names_by_source: SourceFileStringSetCache;

	/** Responsibilities: _namespace import name_. **/
	private namespace_import_name(statement: ts.ImportDeclaration): string {
		const clause = statement.importClause;
		if (clause === undefined || clause.isTypeOnly) {
			return "";
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined || !ts.isNamespaceImport(bindings)) {
			return "";
		}
		return bindings.name.text;
	}

	/** Responsibilities: _CommonJS import-equals name_. **/
	private import_equals_name(candidate: ts.Statement): string {
		if (!ts.isImportEqualsDeclaration(candidate) || candidate.isTypeOnly) {
			return "";
		}
		if (!ts.isExternalModuleReference(candidate.moduleReference)) {
			return "";
		}
		return candidate.name.text;
	}

	/** Responsibilities: _module namespace import name_. **/
	private import_name(candidate: ts.Statement): string {
		if (ts.isImportDeclaration(candidate)) {
			return this.namespace_import_name(candidate);
		}
		return this.import_equals_name(candidate);
	}

	/** Responsibilities: _namespace import index initialization_. **/
	public constructor() {
		this._names_by_source = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
	}

	/** Responsibilities: _source namespace import names_. **/
	public names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached = this._names_by_source.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const names = new Set<string>();
		for (const statement of source_file.statements) {
			const name = this.import_name(statement);
			if (name.length > 0) {
				names.add(name);
			}
		}
		this._names_by_source.set(source_file, names);
		return names;
	}

	/** Responsibilities: _module dependency detection_. **/
	public dependency(candidate: ts.NewExpression): boolean {
		if (candidate.arguments === undefined) {
			return false;
		}
		const names = this.names(candidate.getSourceFile());
		return candidate.arguments.some((argument) => ts.isIdentifier(argument) && names.has(argument.text));
	}
}
