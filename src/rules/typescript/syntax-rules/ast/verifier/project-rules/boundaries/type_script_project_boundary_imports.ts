import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _import binding classification_, _contract import collection_. **/
export class TypeScriptProjectBoundaryImports {
	private readonly _module_resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _import binding selection_. **/
	private import_candidates(import_clause: ts.ImportClause): { local_name: string; exported_name: string }[] {
		const candidates: { local_name: string; exported_name: string }[] = [];
		this.append_default_candidate(import_clause, candidates);
		const bindings = import_clause.namedBindings;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			this.append_named_candidates(bindings, candidates);
		}
		return candidates;
	}

	/** Responsibilities: _default contract binding_. **/
	private append_default_candidate(
		import_clause: ts.ImportClause,
		candidates: { local_name: string; exported_name: string }[],
	): void {
		const name = import_clause.name;
		if (name !== undefined) {
			candidates.push({ local_name: name.text, exported_name: "default" });
		}
	}

	/** Responsibilities: _named contract binding collection_. **/
	private append_named_candidates(
		bindings: ts.NamedImports,
		candidates: { local_name: string; exported_name: string }[],
	): void {
		for (const element of bindings.elements) {
			candidates.push({ local_name: element.name.text, exported_name: this.exported_name(element) });
		}
	}

	/** Responsibilities: _imported contract symbol name_. **/
	private exported_name(element: ts.ImportSpecifier): string {
		const property_name = element.propertyName;
		if (property_name !== undefined) {
			return property_name.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _import statement classification_. **/
	private imported_names(statement: ts.Statement, source_file: ts.SourceFile): ReadonlySet<string> {
		const names = new Set<string>();
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return names;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return names;
		}
		const module_path = this._module_resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (module_path.length === 0) {
			return names;
		}
		return this.collect_clause(clause, module_path);
	}

	/** Responsibilities: _module resolver binding_. **/
	public constructor(module_resolver: TypeScriptModuleExportsContract) {
		this._module_resolver = module_resolver;
	}

	/** Responsibilities: _imported contract collection_. **/
	public collect(source_file: ts.SourceFile): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of source_file.statements) {
			for (const name of this.imported_names(statement, source_file)) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _import clause classification_. **/
	public collect_clause(clause: ts.ImportClause, module_path: string): ReadonlySet<string> {
		const names = new Set<string>();
		for (const candidate of this.import_candidates(clause)) {
			const symbol = this._module_resolver.resolve({ file: module_path, name: candidate.exported_name });
			if (this._module_resolver.symbol_kind(symbol) === ResolvedTypeScriptDeclarationKind.Contract) {
				names.add(candidate.local_name);
			}
		}
		return names;
	}
}
