import ts from 'typescript';
import { ImportedNames } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/imported-names';
import { TypeScriptNamespaceAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/namespace-aliases';
import { TypeScriptDestructuredAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/destructured-aliases';
import { TypeScriptArrayDestructuredAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/array-destructured-aliases';
import { unwrap_transparent_expression } from 'functions';

/** Responsibilities: _class alias resolution_. **/
export class TypeScriptClassAliases {
	private readonly source_file: ts.SourceFile;
	private readonly local_class_names: ReadonlySet<string>;
	private readonly imported_names: ImportedNames;
	private readonly namespace_aliases: TypeScriptNamespaceAliases;

	/** Responsibilities: _module variable declaration collection_. **/
	private module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableStatement(node)) {
				declarations.push(...node.declarationList.declarations);
				return;
			}
			if (ts.isVariableDeclarationList(node)) {
				declarations.push(...node.declarations);
				return;
			}
			ts.forEachChild(node, visit);
		};
		for (const statement of statements) {
			visit(statement);
		}
		return declarations;
	}

	/** Responsibilities: _collection class alias reference_. **/
	private append_class_alias(names: Set<string>, name: string, target: string): boolean {
		if (target === '') {
			return false;
		}
		if (!names.has(target)) {
			return false;
		}
		if (names.has(name)) {
			return false;
		}
		names.add(name);
		return true;
	}

	/** Responsibilities: _class alias assignment identification_. **/
	private append_alias(
		names: Set<string>,
		declaration: ts.VariableDeclaration
	): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			return this.append_class_alias(names, declaration.name.text, initializer.text);
		}
		const target = this.namespace_aliases.target(initializer);
		if (target === '') {
			return false;
		}
		names.add(target);
		return this.append_class_alias(names, declaration.name.text, target);
	}

	/** Responsibilities: _collection declaration alias_. **/
	private append_declaration_alias(
		names: Set<string>,
		declaration: ts.VariableDeclaration,
		destructured_aliases: TypeScriptDestructuredAliases,
		array_destructured_aliases: TypeScriptArrayDestructuredAliases,
	): boolean {
		let alias_added = this.append_alias(names, declaration);
		if (!alias_added) {
			alias_added = destructured_aliases.object_aliases(declaration);
		}
		if (!alias_added) {
			alias_added = array_destructured_aliases.array_aliases(declaration);
		}
		return alias_added;
	}

	/** Responsibilities: _collection declaration aliases_. **/
	private append_declaration_aliases(
		names: Set<string>,
		declarations: readonly ts.VariableDeclaration[],
		destructured_aliases: TypeScriptDestructuredAliases,
		array_destructured_aliases: TypeScriptArrayDestructuredAliases,
	): void {
		destructured_aliases.register_sources(declarations);
		array_destructured_aliases.register_sources(declarations);
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append_declaration_alias(
					names,
					declaration,
					destructured_aliases,
					array_destructured_aliases,
				)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _singleton alias resolver initialization_. **/
	public constructor(source_file: ts.SourceFile, local_class_names: ReadonlySet<string>) {
		this.source_file = source_file;
		this.local_class_names = local_class_names;
		this.imported_names = new ImportedNames(source_file);
		this.namespace_aliases = new TypeScriptNamespaceAliases(source_file);
	}

	/** Responsibilities: _collection class reference aliases_. **/
	public names(): ReadonlySet<string> {
		const names = new Set(this.local_class_names);
		for (const imported of this.imported_names.collect()) {
			names.add(imported);
		}
		const declarations = this.module_variables(this.source_file.statements);
		const destructured_aliases = new TypeScriptDestructuredAliases(names, this.source_file);
		const array_destructured_aliases = new TypeScriptArrayDestructuredAliases(names, this.source_file);
		this.append_declaration_aliases(
			names,
			declarations,
			destructured_aliases,
			array_destructured_aliases,
		);
		return names;
	}

	/** Responsibilities: _classification project class alias_. **/
	public name(name: string): boolean {
		return this.names().has(name);
	}

	/** Responsibilities: _classification qualified class access_. **/
	public access(expression: ts.Expression): boolean {
		const target = this.namespace_aliases.target(expression);
		return target !== '';
	}
}
