import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _import binding classification_, _contract import collection_. **/
export class TypeScriptProjectBoundaryImports {
	private readonly _module_resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _import binding selection_. **/
	private import_candidates(import_clause: ts.ImportClause): { local_name: string; exported_name: string }[] {
		const candidates: { local_name: string; exported_name: string }[] = [];
		if (import_clause.name !== undefined) {
			candidates.push({ local_name: import_clause.name.text, exported_name: "default" });
		}
		const bindings = import_clause.namedBindings;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				candidates.push({
					local_name: element.name.text,
					exported_name: element.propertyName?.text ?? element.name.text,
				});
			}
		}
		return candidates;
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
