import ts from "typescript";
import type { RuleContextData } from "src/types";
import { REST_UNION_CONTRACT } from "src/parser/internals/constants";
import type { RestUnionContractRuleContract } from "src/protocols";
import { RestUnionImportedAliases } from "src/rules/typescript/syntax-rules/types/rest_union_imported_aliases";

/** Responsibilities: _rest-parameter unions identification_, _contract violations addition_. **/
export class RestUnionContractRule implements RestUnionContractRuleContract {
	private readonly rule_id = REST_UNION_CONTRACT;
	private readonly union_kind = ts.SyntaxKind.UnionType;
	private readonly imported_aliases: RestUnionImportedAliases;

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

	/** Responsibilities: _nearest qualified alias lookup_. **/
	private alias_key(node: ts.TypeReferenceNode, aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>): string {
		const parts = this.alias_parts(node.typeName);
		const namespace = this.namespace_parts(node);
		for (let length = namespace.length; length >= 0; length -= 1) {
			const namespace_prefix = namespace.slice(0, length);
			const qualified_parts = [...namespace_prefix, ...parts];
			const key = qualified_parts.join(".");
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
		seen.add(key);
		return this.contains_union(declaration.type, aliases, seen);
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
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.imported_aliases = new RestUnionImportedAliases();
	}
	/** Responsibilities: _public operation_. **/
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
		const aliases = this.imported_aliases.aliases_for(
			node.getSourceFile(),
			context.module_resolver,
			context.source_resolver,
		);
		if (this.contains_union(node.type, aliases, new Set())) {
			context.append_rule(node, this.rule_id);
		}
	}
}
