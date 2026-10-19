import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import type { TypeScriptCallReturnAnalysisContract } from "src/protocols";
import type { TypeScriptModuleExportLookupContract } from "src/module-resolution/types";
import { TypeScriptModuleExports } from "src/parser/analysis/type_script_module_exports";
import ts from "typescript";
import type { TypeScriptImportedCallOwnersContract } from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _external owners_, _owner identity_. **/
export class TypeScriptImportedCallOwners implements TypeScriptImportedCallOwnersContract {
	private readonly source_file: ts.SourceFile;
	private readonly script_module_exports: TypeScriptModuleExportLookupContract;
	private readonly owners: Map<string, string>;

	/** Responsibilities: _resolution owner imported callable_. **/
	private imported_call_owner(imported_file: string, exported_name: string): string {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();
		const declarations = this.script_module_exports.resolved_exported_declaration(imported_file, exported_name);
		for (const declaration of declarations) {
			const owner = this.exported_owner(declaration, call_return_analysis);
			if (owner.length > 0) {
				return owner;
			}
		}
		return "";
	}

	/** Responsibilities: _resolution exported callable owner_. **/
	private exported_owner(declaration: ts.Node, analysis: TypeScriptCallReturnAnalysisContract): string {
		if (ts.isFunctionDeclaration(declaration)) {
			if (declaration.type === undefined) {
				return "";
			}
			return analysis.reference_owner(declaration.type);
		}
		if (!ts.isVariableDeclaration(declaration)) {
			return "";
		}
		const initializer = declaration.initializer;
		if (initializer === undefined || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
			return "";
		}
		if (initializer.type === undefined) {
			return "";
		}
		return analysis.reference_owner(initializer.type);
	}

	/** Responsibilities: _resolution owners named bindings_. **/
	private imported_binding_owner(imported_file: string, binding: ts.ImportSpecifier): string {
		let exported_name = binding.propertyName?.text;
		if (exported_name === undefined) {
			exported_name = binding.name.text;
		}
		return this.imported_call_owner(imported_file, exported_name);
	}

	/** Responsibilities: _aggregation owner mappings named_. **/
	private append_imported_bindings(bindings: ts.NamedImports, imported_file: string): void {
		for (const binding of bindings.elements) {
			const owner = this.imported_binding_owner(imported_file, binding);
			if (owner) {
				this.owners.set(binding.name.text, owner);
			}
		}
	}

	/** Responsibilities: _collection imported callable owner_. **/
	private collect_imported_calls(): void {
		for (const statement of this.source_file.statements) {
			const bindings = this.script_module_exports.named_imports(statement);
			const file = this.script_module_exports.imported_file(this.source_file, statement);
			if (bindings.length === 0) {
				continue;
			}
			if (!file) {
				continue;
			}
			this.append_imported_bindings(bindings[0], file);
		}
	}

	/** Responsibilities: _initialization source import resolvers_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this.owners = new Map<string, string>();
		this.source_file = source_file;
		this.script_module_exports = new TypeScriptModuleExports(project_root, source_files, false, source_io);
	}

	/** Responsibilities: _output resolution imported callable_. **/
	public collect(): ReadonlyMap<string, string> {
		this.collect_imported_calls();
		return this.owners;
	}

	/** Responsibilities: _aggregation resolution imported owners_. **/
	public append_to(owners: Map<string, string>): void {
		for (const [name, owner] of this.collect()) {
			owners.set(name, owner);
		}
	}
}
