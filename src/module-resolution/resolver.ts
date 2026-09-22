import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { statSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve as resolve_path } from 'node:path';
import ts from 'typescript';
import { TypeScriptDeclarationTable } from 'src/module-resolution/declaration-resolver';
import { TypeScriptExportLinksTable } from 'src/module-resolution/export-link-resolver';
import type { TypeScriptDeclarations, TypeScriptExportLinks } from 'src/module-resolution/protocols';
import type { RecursiveExportResolver, ResolvedTypeScriptExport } from 'src/module-resolution/types';

/** Responsibilities: _resolution TypeScript modules local_. **/
export class TypeScriptModuleExports implements RecursiveExportResolver {
	private readonly declarations: TypeScriptDeclarations;
	private readonly source_extensions = ['.ts', '.tsx'];
	private readonly links: TypeScriptExportLinks;

	/** Responsibilities: _file candidates module generation_. **/
	private module_candidates(base: string): string[] {
		return [
			base,
			...this.source_extensions.map(extension => `${base}${extension}`),
			...this.source_extensions.map(extension => resolve_path(base, `index${extension}`)),
		];
	}

	/** Responsibilities: _resolution local exported declaration_. **/
	private local_export(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const direct = this.declarations.direct_declaration(file, source_file, name, true);
		if (direct.file.length > 0) {
			return direct;
		}
		const default_declaration = this.declarations.default_declaration(file, source_file, name);
		if (default_declaration.file.length > 0) {
			return default_declaration;
		}
		return this.declarations.export_assignment(file, source_file, name, visited, this);
	}

	/** Responsibilities: _resolution export forwarded through_. **/
	private forwarded_export(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const named = this.links.named_export(file, source_file, name, visited);
		if (named.file.length > 0) {
			return named;
		}
		return this.links.star_export(file, source_file, name, visited);
	}

	/** Responsibilities: _initialization recursive export module_. **/
	constructor() {
		this.declarations = new TypeScriptDeclarationTable();
		this.links = new TypeScriptExportLinksTable(this, this);
	}

	/** Responsibilities: _resolution source file import_. **/
	public file_for(
		file: string,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const visit_key = `${file}:${name}`;
		if (visited.has(visit_key)) {
			return { file: '', name: '' };
		}
		visited.add(visit_key);
		const source_file = ts.createSourceFile(
			file,
			readFileSync(file, 'utf8'),
			ts.ScriptTarget.Latest,
			true
		);
		const local = this.local_export(file, name, source_file, visited);
		if (local.file.length > 0) {
			return local;
		}
		return this.forwarded_export(file, name, source_file, visited);
	}

	/** Responsibilities: _resolution local symbol declaration_. **/
	public local_symbol(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const direct = this.declarations.direct_declaration(file, source_file, name, false);
		if (direct.file.length > 0) {
			return direct;
		}
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			const resolved = this.links.imported_binding(file, statement, name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution named export recursively_. **/
	public resolve(file: string, name: string): ResolvedTypeScriptExport {
		return this.file_for(file, name, new Set());
	}

	/** Responsibilities: _resolution symbol represented module_. **/
	public module_symbol(file: string, module_name: string): string {
		const base = resolve_path(dirname(file), module_name);
		for (const candidate of this.module_candidates(base)) {
			if (existsSync(candidate) && statSync(candidate).isFile()) {
				return candidate;
			}
		}
		return '';
	}
}
