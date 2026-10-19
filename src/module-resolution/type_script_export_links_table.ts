import ts from "typescript";
import type {
	ModulePathResolver,
	RecursiveExportResolver,
	ResolvedTypeScriptExport,
	TypeScriptModuleCache,
	TypeScriptNamedExportIndex,
	TypeScriptNamedExportLink,
} from "src/module-resolution/types";
import type { TypeScriptExportLinksContract } from "src/module-resolution/protocols";

/** Responsibilities: _export link indexing_, _imported binding resolution_. **/
export class TypeScriptExportLinksTable implements TypeScriptExportLinksContract {
	private readonly resolver: RecursiveExportResolver;
	private readonly module_paths: ModulePathResolver;
	private readonly module_cache: TypeScriptModuleCache;

	/** Responsibilities: _named export link addition_. **/
	private append_link(
		index: Map<string, TypeScriptNamedExportLink[]>,
		statement: ts.ExportDeclaration,
		element: ts.ExportSpecifier,
	): void {
		const links = index.get(element.name.text);
		if (links === undefined) {
			index.set(element.name.text, [{ statement, element }]);
			return;
		}
		links.push({ statement, element });
	}

	/** Responsibilities: _named export statement indexing_. **/
	private append_statement(
		index: Map<string, TypeScriptNamedExportLink[]>,
		statement: ts.Statement,
	): void {
		if (!ts.isExportDeclaration(statement)) {
			return;
		}
		const export_clause = statement.exportClause;
		if (export_clause === undefined) {
			return;
		}
		if (!ts.isNamedExports(export_clause)) {
			return;
		}
		for (const element of export_clause.elements) {
			this.append_link(index, statement, element);
		}
	}

	/** Responsibilities: _named export index construction_. **/
	private named_export_index(source_file: ts.SourceFile): TypeScriptNamedExportIndex {
		const cached = this.module_cache.named_export_indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, TypeScriptNamedExportLink[]>();
		for (const statement of source_file.statements) {
			this.append_statement(index, statement);
		}
		this.module_cache.named_export_indexes.set(source_file, index);
		return index;
	}

	/** Responsibilities: _resolution source file referenced_. **/
	private imported_file(statement: ts.ImportDeclaration, file: string): string {
		const module_specifier = statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return "";
		}
		return this.module_paths.module_symbol(file, module_specifier.text);
	}

	/** Responsibilities: _resolution target declaration named_. **/
	private named_element_target(
		file: string,
		source_file: ts.SourceFile,
		statement: ts.ExportDeclaration,
		element: ts.ExportSpecifier,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = element.propertyName.text;
		}
		const module_specifier = statement.moduleSpecifier;
		if (module_specifier === undefined) {
			return this.resolver.local_symbol(file, source_file, source_name, visited);
		}
		if (!ts.isStringLiteral(module_specifier)) {
			return this.resolver.local_symbol(file, source_file, source_name, visited);
		}
		const imported_file = this.module_paths.module_symbol(file, module_specifier.text);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this.resolver.file_for(imported_file, source_name, visited);
	}

	/** Responsibilities: _resolution named export links_. **/
	/** Responsibilities: _resolution star-export links source_. **/
	private star_statement(
		file: string,
		statement: ts.ExportDeclaration,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const module_specifier = statement.moduleSpecifier;
		if (module_specifier === undefined) {
			return { file: "", name: "" };
		}
		if (!ts.isStringLiteral(module_specifier)) {
			return { file: "", name: "" };
		}
		const imported_file = this.module_paths.module_symbol(file, module_specifier.text);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this.resolver.file_for(imported_file, name, visited);
	}

	/** Responsibilities: _resolution local named binding_. **/
	private named_binding(
		imported_file: string,
		clause: ts.ImportClause,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		if (clause.namedBindings === undefined) {
			return { file: "", name: "" };
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return { file: "", name: "" };
		}
		for (const binding of clause.namedBindings.elements) {
			if (binding.name.text !== name) {
				continue;
			}
			let imported_name = binding.name.text;
			if (binding.propertyName !== undefined) {
				imported_name = binding.propertyName.text;
			}
			return this.resolver.file_for(imported_file, imported_name, visited);
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _initialization recursive export module_. **/
	constructor(
		resolver: RecursiveExportResolver,
		module_paths: ModulePathResolver,
		module_cache: TypeScriptModuleCache,
	) {
		this.resolver = resolver;
		this.module_paths = module_paths;
		this.module_cache = module_cache;
	}

	/** Responsibilities: _resolution named export target_. **/
	public named_export(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const links = this.named_export_index(source_file).get(name);
		if (links === undefined) {
			return { file: "", name: "" };
		}
		for (const link of links) {
			const resolved = this.named_element_target(file, source_file, link.statement, link.element, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _resolution star export target_. **/
	public star_export(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		for (const statement of source_file.statements) {
			if (!ts.isExportDeclaration(statement)) {
				continue;
			}
			if (statement.exportClause !== undefined) {
				continue;
			}
			const resolved = this.star_statement(file, statement, name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _resolution exported target represented_. **/
	public imported_binding(
		file: string,
		statement: ts.ImportDeclaration,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const imported_file = this.imported_file(statement, file);
		const clause = statement.importClause;
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		if (clause === undefined) {
			return { file: "", name: "" };
		}
		if (clause.name !== undefined) {
			if (clause.name.text === name) {
				return this.imported_binding_name(file, statement, "default", visited);
			}
		}
		return this.named_binding(imported_file, clause, name, visited);
	}

	/** Responsibilities: _resolution indexed imported binding_. **/
	public imported_binding_name(
		file: string,
		statement: ts.ImportDeclaration,
		imported_name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const imported_file = this.imported_file(statement, file);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this.resolver.file_for(imported_file, imported_name, visited);
	}
}
