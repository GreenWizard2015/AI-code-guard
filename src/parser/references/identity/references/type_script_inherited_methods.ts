import ts from "typescript";
import type { TypeScriptModuleExportsContract, ResolvedTypeScriptExport } from "src/module-resolution/types";

/** Responsibilities: _direct method lookup_, _recursive inherited method lookup_. **/
export class TypeScriptInheritedMethods {
	private readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly module_exports: TypeScriptModuleExportsContract;
	private readonly method_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _direct method file lookup_. **/
	private direct_method_file(file: string, class_name: string, method: string): string {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return "";
		}
		return this.source_method_file(source, file, class_name, method);
	}

	/** Responsibilities: _source method file lookup_. **/
	private source_method_file(source: ts.SourceFile, file: string, class_name: string, method: string): string {
		for (const statement of source.statements) {
			if (ts.isClassLike(statement) === false) {
				continue;
			}
			if (statement.name?.text !== class_name) {
				continue;
			}
			if (this.class_declares_method(statement, source, method)) {
				return file;
			}
		}
		return "";
	}

	/** Responsibilities: _class method lookup_. **/
	private class_declares_method(node: ts.ClassLikeDeclaration, source: ts.SourceFile, method: string): boolean {
		for (const member of node.members) {
			if (this.method_kinds.has(member.kind) === false) {
				continue;
			}
			if (member.name !== undefined && member.name.getText(source) === method) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _class base-name lookup_. **/
	private class_base_names(file: string, class_name: string): string[] {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return [];
		}
		for (const statement of source.statements) {
			if (ts.isClassLike(statement) === false) {
				continue;
			}
			if (statement.name?.text === class_name) {
				return this.base_names(statement, source);
			}
		}
		return [];
	}

	/** Responsibilities: _base class name extraction_. **/
	private base_names(node: ts.ClassLikeDeclaration, source: ts.SourceFile): string[] {
		const heritage = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
		if (heritage === undefined) {
			return [];
		}
		const names: string[] = [];
		for (const type of heritage.types) {
			const parts = type.expression.getText(source).split(".");
			const name = parts[parts.length - 1];
			if (name !== undefined) {
				names.push(name);
			}
		}
		return names;
	}

	/** Responsibilities: _base class export resolution_. **/
	private base_export(file: string, source: ts.SourceFile, name: string): ResolvedTypeScriptExport {
		const local = this.module_exports.local_symbol(file, source, name, new Set<string>());
		if (local.file.length > 0) {
			return local;
		}
		return this.module_exports.resolve(file, name);
	}

	/** Responsibilities: _base method file lookup_. **/
	private base_method_file(file: string, class_name: string, method: string, seen: Set<string>): string {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return "";
		}
		for (const base_name of this.class_base_names(file, class_name)) {
			const base = this.base_export(file, source, base_name);
			if (base.file.length === 0 || base.name.length === 0) {
				continue;
			}
			const resolved = this.inherited_method_file(base.file, base.name, method, seen);
			if (resolved.length > 0) {
				return resolved;
			}
		}
		return "";
	}

	/** Responsibilities: _recursive inherited method lookup_. **/
	private inherited_method_file(file: string, class_name: string, method: string, seen: Set<string>): string {
		const key = `${file}\u0000${class_name}\u0000${method}`;
		if (seen.has(key)) {
			return "";
		}
		seen.add(key);
		const direct = this.direct_method_file(file, class_name, method);
		if (direct.length > 0) {
			return direct;
		}
		return this.base_method_file(file, class_name, method, seen);
	}

	/** Responsibilities: _resolver initialization_. **/
	public constructor(
		source_files: ReadonlyMap<string, ts.SourceFile>,
		module_exports: TypeScriptModuleExportsContract,
	) {
		this.source_files = source_files;
		this.module_exports = module_exports;
		this.method_kinds = new Set<ts.SyntaxKind>([
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
		]);
	}

	/** Responsibilities: _inherited method file lookup_. **/
	public file(file: string, class_name: string, method: string): string {
		return this.inherited_method_file(file, class_name, method, new Set<string>());
	}

	/** Responsibilities: _inherited method membership_. **/
	public contains(file: string, class_name: string, method: string): boolean {
		return this.file(file, class_name, method).length > 0;
	}
}
