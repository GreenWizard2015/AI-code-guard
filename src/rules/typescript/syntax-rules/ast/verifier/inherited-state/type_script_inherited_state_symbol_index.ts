import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleExportsContract, TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type {
	InheritedStateDeclaration,
	InheritedStateImportBinding,
	InheritedStateImportScope,
	InheritedStateModuleContext,
} from "src/rules/typescript/syntax-rules/types";
import ts from "typescript";

/** Responsibilities: _project class identity index_, _canonical import identities_. **/
export class TypeScriptInheritedStateSymbolIndex {
	private readonly _module_exports: TypeScriptModuleExportsContract;

	/** Responsibilities: _imported symbol identity_. **/
	private resolved_binding(symbol: TypeScriptModuleSymbolReference, namespace: boolean): InheritedStateImportBinding {
		if (namespace) {
			return { symbol, namespace };
		}
		const resolved = this._module_exports.resolve(symbol);
		if (resolved.file.length === 0) {
			return { symbol, namespace };
		}
		return { symbol: resolved, namespace };
	}

	/** Responsibilities: _namespace import bindings_. **/
	private append_named_bindings(named_bindings: ts.NamedImportBindings, import_scope: InheritedStateImportScope): void {
		if (ts.isNamespaceImport(named_bindings)) {
			import_scope.module.imports.set(named_bindings.name.text, {
				symbol: { file: import_scope.module_file, name: "" },
				namespace: true,
			});
			return;
		}
		for (const element of named_bindings.elements) {
			const property_name = element.propertyName;
			let exported_name = element.name.text;
			if (property_name !== undefined) {
				exported_name = property_name.text;
			}
			const symbol = this.resolved_binding({ file: import_scope.module_file, name: exported_name }, false);
			import_scope.module.imports.set(element.name.text, symbol);
		}
	}

	/** Responsibilities: _import clause bindings_. **/
	private append_import_clause(clause: ts.ImportClause, import_scope: InheritedStateImportScope): void {
		if (clause.name !== undefined) {
			const default_symbol = this.resolved_binding({ file: import_scope.module_file, name: "default" }, false);
			import_scope.module.imports.set(clause.name.text, default_symbol);
		}
		if (clause.namedBindings !== undefined) {
			this.append_named_bindings(clause.namedBindings, import_scope);
		}
	}

	/** Responsibilities: _namespace import identity_. **/
	private namespace_base_id(
		imports: ReadonlyMap<string, InheritedStateImportBinding>,
		name: string,
		namespace_separator: number,
		local_identity: string,
	): string {
		const namespace_binding = imports.get(name.slice(0, namespace_separator));
		if (namespace_binding === undefined || !namespace_binding.namespace) {
			return local_identity;
		}
		const symbol = this.resolved_binding(
			{
				file: namespace_binding.symbol.file,
				name: name.slice(namespace_separator + 1),
			},
			false,
		).symbol;
		return `${symbol.file}\u0000${symbol.name}`;
	}

	/** Responsibilities: _base symbol identity_. **/
	private base_symbol_id(
		imports: ReadonlyMap<string, InheritedStateImportBinding>,
		source_file: ts.SourceFile,
		name: string,
	): string {
		const direct = imports.get(name);
		if (direct !== undefined && !direct.namespace) {
			return `${direct.symbol.file}\u0000${direct.symbol.name}`;
		}
		const local_identity = `${source_file.fileName}\u0000${name}`;
		const namespace_separator = name.indexOf(".");
		if (namespace_separator < 0) {
			return local_identity;
		}
		return this.namespace_base_id(imports, name, namespace_separator, local_identity);
	}

	/** Responsibilities: _module export resolver_. **/
	public constructor(module_exports: TypeScriptModuleExportsContract) {
		this._module_exports = module_exports;
	}

	/** Responsibilities: _source module import identities_. **/
	public source_module(source_file: ts.SourceFile): InheritedStateModuleContext {
		const module: InheritedStateModuleContext = {
			source_file,
			imports: new Map(),
		};
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const clause = statement.importClause;
			if (clause === undefined) {
				continue;
			}
			const module_file = this._module_exports.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
			if (module_file.length > 0) {
				this.append_import_clause(clause, { module_file, module });
			}
		}
		return module;
	}

	/** Responsibilities: _source module base identities_. **/
	public resolve_base_symbols(
		module: InheritedStateModuleContext,
		base_names: readonly (readonly string[])[],
	): string[][] {
		const resolved: string[][] = [];
		for (const names of base_names) {
			resolved.push(names.map((name) => this.base_symbol_id(module.imports, module.source_file, name)));
		}
		return resolved;
	}

	/** Responsibilities: _class inheritance records_. **/
	public declarations_for_file(
		classes: readonly AstClassNode[],
		syntax_nodes: readonly ts.Node[],
		module: InheritedStateModuleContext,
	): InheritedStateDeclaration[] {
		const base_symbol_ids = this.resolve_base_symbols(
			module,
			classes.map((node) => node.structure.base_class_names),
		);
		const declarations: InheritedStateDeclaration[] = [];
		for (let index = 0; index < classes.length; index += 1) {
			const node = classes[index];
			const syntax_node = syntax_nodes[index];
			const base_symbols = base_symbol_ids[index];
			if (node === undefined || syntax_node === undefined || base_symbols === undefined) {
				continue;
			}
			const symbol_id = `${module.source_file.fileName}\u0000${node.identity.name}`;
			declarations.push({ node, symbol_id, base_symbol_ids: base_symbols, syntax_node });
		}
		return declarations;
	}
}
