import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { PythonCompositionImportsContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { SharedParameterTypeSourceIndexContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { SharedParameterTypeSource } from "src/metrics/types";
import type { NormalizedAstSource } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _source import resolution_, _shared type registration_. **/
export class SharedParameterSourceImports {
	private readonly _source: LintSourceRecordData;
	private readonly _declarations: NormalizedAstSource;
	private readonly _resolver: TypeScriptModuleExportsContract;
	private readonly _python_imports: PythonCompositionImportsContract;
	private readonly _index: SharedParameterTypeSourceIndexContract;

	/** Responsibilities: _named import declarations_. **/
	private named_imports(statement: ts.ImportDeclaration): readonly ts.ImportSpecifier[] {
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _imported type source candidates_. **/
	private append_imported_type(element: ts.ImportSpecifier, resolved: SharedParameterTypeSource): void {
		if (resolved.file.length === 0) {
			return;
		}
		let imported_name = element.name.text;
		if (element.propertyName !== undefined) {
			imported_name = element.propertyName.text;
		}
		const names = new Set([element.name.text, imported_name, resolved.name]);
		const local_names = [...names];
		const keys = new Set(local_names.map((name) => JSON.stringify([this._source.relative_path, name])));
		this._index.append(keys, { file: resolved.file, name: resolved.name });
	}

	/** Responsibilities: _TypeScript import declaration resolution_. **/
	private append_import_declaration(statement: ts.ImportDeclaration): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const imported_file = this._resolver.module_symbol(this._source.absolute_path, statement.moduleSpecifier.text);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of this.named_imports(statement)) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			this.append_imported_type(element, this._resolver.resolve({ file: imported_file, name: imported_name }));
		}
	}

	/** Responsibilities: _source import collection setup_. **/
	public constructor(
		source: LintSourceRecordData,
		resolver: TypeScriptModuleExportsContract,
		python_imports: PythonCompositionImportsContract,
		index: SharedParameterTypeSourceIndexContract,
	) {
		this._source = source;
		this._declarations = source.normalized_ast.source;
		this._resolver = resolver;
		this._python_imports = python_imports;
		this._index = index;
	}

	/** Responsibilities: _TypeScript imported type collection_. **/
	public append_typescript_imports(): void {
		if (this._source.language !== TYPESCRIPT_LANGUAGE) {
			return;
		}
		for (const statement of this._source.typescript_ast.source_file_node().statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_import_declaration(statement);
			}
		}
	}

	/** Responsibilities: _Python imported type collection_. **/
	public append_python_imports(): void {
		const imports = this._declarations.python_imports;
		if (imports === undefined) {
			return;
		}
		const imported_symbols = this._python_imports.python_imports(this._source.absolute_path, imports);
		for (const [local_name, imported] of imported_symbols) {
			if (imported.file.length === 0 || imported.name.length === 0) {
				continue;
			}
			const names = new Set([local_name, imported.name]);
			const local_names = [...names];
			const keys = new Set(local_names.map((name) => JSON.stringify([this._source.relative_path, name])));
			this._index.append(keys, { file: imported.file, name: imported.name });
		}
	}
}
