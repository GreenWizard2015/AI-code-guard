import { TypeScriptCallReturnAnalysis } from 'src/bridge/ts/parser/typescript-call-return-analysis';
import { TypeScriptModuleExports } from 'src/bridge/ts/parser/typescript-module-exports';
import { readFileSync } from 'node:fs';

import ts from 'typescript';

import type { TypeScriptSourceResolver } from 'src/model/types';

/** Responsibilities: _resolution imported callable owners_. **/
export class TypeScriptImportedCallOwners {
	private readonly source_file: ts.SourceFile;
	private readonly source_resolver: TypeScriptSourceResolver;
	private readonly owners = new Map<string, string>();

	/** Responsibilities: _resolution parsing source file_. **/
	private imported_source(imported_file: string): ts.SourceFile {
		const sources = this.source_resolver(imported_file);
		if (sources.length > 0) {
			return sources[0];
		}
		return ts.createSourceFile(
			imported_file,
			readFileSync(imported_file, 'utf8'),
			ts.ScriptTarget.Latest,
			true
		);
	}

	/** Responsibilities: _resolution owner imported callable_. **/
	private imported_call_owner(
		source_file: ts.SourceFile,
		exported_name: string
	): string {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();
		const script_module_exports = new TypeScriptModuleExports();

		for (const statement of source_file.statements) {
			if (!script_module_exports.export(statement)) {
				continue;
			}
			const owner = this.exported_owner(
				statement,
				exported_name,
				call_return_analysis,
				script_module_exports
			);
			if (owner) {
				return owner;
			}
		}
		return '';
	}

	/** Responsibilities: _resolution exported callable owner_. **/
	private exported_owner(
		statement: ts.Statement,
		exported_name: string,
		analysis: TypeScriptCallReturnAnalysis,
		module_exports: TypeScriptModuleExports
	): string {
		const return_types = module_exports.exported_return_type(statement, exported_name);
		if (return_types.length === 0) {
			return '';
		}
		return analysis.reference_owner(return_types[0]);
	}

	/** Responsibilities: _resolution owners named bindings_. **/
	private imported_binding_owner(
		source_file: ts.SourceFile,
		binding: ts.ImportSpecifier
	): string {
		let exported_name = binding.propertyName?.text;
		if (exported_name === undefined) {
			exported_name = binding.name.text;
		}
		return this.imported_call_owner(source_file, exported_name);
	}

	/** Responsibilities: _aggregation owner mappings named_. **/
	private append_imported_bindings(bindings: ts.NamedImports, imported_file: string): void {
		const imported_source = this.imported_source(imported_file);
		for (const binding of bindings.elements) {
			const owner = this.imported_binding_owner(imported_source, binding);
			if (owner) {
				this.owners.set(binding.name.text, owner);
			}
		}
	}

	/** Responsibilities: _collection imported callable owner_. **/
	private collect_imported_calls(): void {
		const script_module_exports = new TypeScriptModuleExports();

		for (const statement of this.source_file.statements) {
			const bindings = script_module_exports.named_imports(statement);
			const file = script_module_exports.imported_file(this.source_file, statement);
			if (bindings.length === 0 || !file) {
				continue;
			}
			this.append_imported_bindings(bindings[0], file);
		}
	}

	/** Responsibilities: _initialization source import resolvers_. **/
	public constructor(source_file: ts.SourceFile, ...resolvers: TypeScriptSourceResolver[]) {
		this.source_file = source_file;
		let source_resolver: TypeScriptSourceResolver = () => [];
		if (resolvers[0] !== undefined) {
			source_resolver = resolvers[0];
		}
		this.source_resolver = source_resolver;
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
