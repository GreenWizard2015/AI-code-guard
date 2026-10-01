import ts from "typescript";
import { TypeScriptModuleExports } from "src/module-resolution/resolver";
import type { RuleContextData } from "src/types";
import type { SourceFileResolver } from "src/protocols";
import { REST_UNION_CONTRACT } from "src/bridge/ts/parser-internals/constants";

/** Responsibilities: _rest-parameter unions identification_, _contract violations addition_. **/
export class RestUnionContractRule {
	private readonly rule_id = REST_UNION_CONTRACT;
	private readonly union_kind = ts.SyntaxKind.UnionType;
	private readonly module_exports = new TypeScriptModuleExports();

	/** Responsibilities: _qualified alias decomposition_. **/
	private alias_parts(name: ts.EntityName): readonly string[] {
		if (ts.isIdentifier(name)) {
			return [name.text];
		}
		return [...this.alias_parts(name.left), name.right.text];
	}

	/** Responsibilities: _enclosing namespace name parts_. **/
	private namespace_parts(node: ts.Node): readonly string[] {
		const parts: string[] = [];
		let current: ts.Node | undefined = node.parent;
		while (current !== undefined) {
			if (ts.isModuleDeclaration(current)) {
				parts.unshift(current.name.getText());
			}
			current = current.parent;
		}
		return parts;
	}

	/** Responsibilities: _nested type alias collection_. **/
	private collect_aliases(
		node: ts.Node,
		namespace: readonly string[],
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		if (ts.isModuleDeclaration(node)) {
			if (node.body !== undefined) {
				this.collect_aliases(node.body, [...namespace, node.name.getText()], aliases);
			}
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			aliases.set([...namespace, node.name.text].join("."), node);
		}
		node.forEachChild((child) => this.collect_aliases(child, namespace, aliases));
	}

	/** Responsibilities: _source type alias collection_. **/
	private alias_declarations(source_file: ts.SourceFile): ReadonlyMap<string, ts.TypeAliasDeclaration> {
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		source_file.forEachChild((node) => this.collect_aliases(node, [], aliases));
		return aliases;
	}

	/** Responsibilities: _import name_. **/
	private imported_name(element: ts.ImportSpecifier): string {
		if (element.propertyName !== undefined) {
			return element.propertyName.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _source aliases_. **/
	private append_source_aliases(
		bindings: ts.NamedImports,
		imported_source: ts.SourceFile,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		const imported_aliases = this.alias_declarations(imported_source);
		for (const element of bindings.elements) {
			const imported_name = this.imported_name(element);
			const declaration = imported_aliases.get(imported_name);
			if (declaration !== undefined) {
				aliases.set(element.name.text, declaration);
			}
		}
	}

	/** Responsibilities: _declaration aliases_. **/
	private append_named_aliases(
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		bindings: ts.NamedImports,
		source_resolver: SourceFileResolver,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const imported_file = this.module_exports.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (imported_file.length === 0) {
			return;
		}
		for (const imported_source of source_resolver(imported_file)) {
			this.append_source_aliases(bindings, imported_source, aliases);
			return;
		}
	}

	/** Responsibilities: _declaration aliases_. **/
	private append_declaration_aliases(
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		source_resolver: SourceFileResolver,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(bindings)) {
			return;
		}
		this.append_named_aliases(source_file, statement, bindings, source_resolver, aliases);
	}

	/** Responsibilities: _collection imported type aliases_. **/
	private imported_aliases(
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolver,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_declaration_aliases(source_file, statement, source_resolver, aliases);
			}
		}
	}
	/** Responsibilities: _nearest qualified alias lookup_. **/
	private alias_key(node: ts.TypeReferenceNode, aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>): string {
		const parts = this.alias_parts(node.typeName);
		const namespace = this.namespace_parts(node);
		for (let length = namespace.length; length >= 0; length -= 1) {
			const key = [...namespace.slice(0, length), ...parts].join(".");
			if (aliases.has(key)) {
				return key;
			}
		}
		return "";
	}

	/** Responsibilities: _referenced union declaration search_. **/
	private referenced_union_alias(
		node: ts.TypeReferenceNode,
		aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		seen: Set<string>,
	): boolean {
		const key = this.alias_key(node, aliases);
		if (key.length === 0) {
			return false;
		}
		if (seen.has(key)) {
			return false;
		}
		const declaration = aliases.get(key);
		if (declaration === undefined) {
			return false;
		}
		const next_seen = new Set(seen);
		next_seen.add(key);
		return this.contains_union(declaration.type, aliases, next_seen);
	}

	/** Responsibilities: _referenced union alias search_. **/
	private referenced_union(
		node: ts.Node,
		aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		seen: Set<string>,
	): boolean {
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		return this.referenced_union_alias(node, aliases, seen);
	}

	/** Responsibilities: _node subtree union search_. **/
	private contains_union(
		node: ts.Node,
		aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		seen: Set<string>,
	): boolean {
		if (node.kind === this.union_kind) {
			return true;
		}
		if (this.referenced_union(node, aliases, seen)) {
			return true;
		}
		let found = false;
		node.forEachChild((child) => {
			if (!found && this.contains_union(child, aliases, seen)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _typed rest parameters identification_. **/
	public rest_parameter(node: ts.Node): boolean {
		if (!ts.isParameter(node)) {
			return false;
		}
		if (node.dotDotDotToken === undefined) {
			return false;
		}
		return node.type !== undefined;
	}

	/** Responsibilities: _aggregation rest-union contract violation_. **/
	public append_rule(node: ts.Node, context: RuleContextData): void {
		if (!this.rest_parameter(node)) {
			return;
		}
		if (!ts.isParameter(node)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		const aliases = new Map(this.alias_declarations(node.getSourceFile()));
		this.imported_aliases(node.getSourceFile(), context.source_resolver, aliases);
		if (this.contains_union(node.type, aliases, new Set())) {
			context.append_rule(node, this.rule_id);
		}
	}
}
