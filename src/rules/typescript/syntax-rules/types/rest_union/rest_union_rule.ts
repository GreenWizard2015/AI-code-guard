import type { RestUnionRuleContract } from "src/analysis_protocols";
import { REST_UNION_CONTRACT } from "src/parser/internals/constants";
import { RestUnionImportedAliases } from "src/rules/typescript/syntax-rules/types/rest_union/rest_union_imported_aliases";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _rest-parameter unions identification_, _contract violations addition_. **/
export class RestUnionRule implements RestUnionRuleContract {
	private readonly _rule_id: string;
	private readonly _union_kind: ts.SyntaxKind;
	private readonly _imported_aliases: RestUnionImportedAliases;

	/** Responsibilities: _qualified alias decomposition_. **/
	private alias_parts(name: ts.EntityName): readonly string[] {
		if (ts.isIdentifier(name)) {
			return [name.text];
		}
		return [...this.alias_parts(name.left), name.right.text];
	}

	/** Responsibilities: _enclosing namespace name parts_. **/
	private namespace_parts(type_reference: ts.Node): readonly string[] {
		const parts: string[] = [];
		let current: ts.Node | undefined = type_reference.parent;
		while (current !== undefined) {
			if (ts.isModuleDeclaration(current)) {
				parts.unshift(current.name.getText());
			}
			current = current.parent;
		}
		return parts;
	}

	/** Responsibilities: _nearest qualified alias lookup_. **/
	private alias_key(
		type_reference: ts.TypeReferenceNode,
		lookup_aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
	): string {
		const parts = this.alias_parts(type_reference.typeName);
		const namespace = this.namespace_parts(type_reference);
		for (let length = namespace.length; length >= 0; length -= 1) {
			const namespace_prefix = namespace.slice(0, length);
			const qualified_parts = [...namespace_prefix, ...parts];
			const key = qualified_parts.join(".");
			if (lookup_aliases.has(key)) {
				return key;
			}
		}
		return "";
	}

	/** Responsibilities: _referenced union declaration search_. **/
	private referenced_union_alias(
		type_reference: ts.TypeReferenceNode,
		referenced_aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		visited_aliases: Set<string>,
	): boolean {
		const key = this.alias_key(type_reference, referenced_aliases);
		if (key.length === 0) {
			return false;
		}
		if (visited_aliases.has(key)) {
			return false;
		}
		const declaration = referenced_aliases.get(key);
		if (declaration === undefined) {
			return false;
		}
		visited_aliases.add(key);
		return this.contains_union(declaration.type, referenced_aliases, visited_aliases);
	}

	/** Responsibilities: _referenced union alias search_. **/
	private referenced_union(
		type_candidate: ts.Node,
		alias_lookup: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		alias_path: Set<string>,
	): boolean {
		if (!ts.isTypeReferenceNode(type_candidate)) {
			return false;
		}
		return this.referenced_union_alias(type_candidate, alias_lookup, alias_path);
	}

	/** Responsibilities: _node subtree union search_. **/
	private contains_union(
		type_subtree: ts.Node,
		union_aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>,
		traversal_path: Set<string>,
	): boolean {
		if (type_subtree.kind === this._union_kind) {
			return true;
		}
		if (this.referenced_union(type_subtree, union_aliases, traversal_path)) {
			return true;
		}
		let found = false;
		type_subtree.forEachChild((child) => {
			if (!found && this.contains_union(child, union_aliases, traversal_path)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _typed rest parameters identification_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._rule_id = REST_UNION_CONTRACT;
		this._union_kind = ts.SyntaxKind.UnionType;
		this._imported_aliases = new RestUnionImportedAliases();
	}
	/** Responsibilities: _public operation_. **/
	public rest_parameter(parameter_candidate: ts.Node): boolean {
		if (!ts.isParameter(parameter_candidate)) {
			return false;
		}
		if (parameter_candidate.dotDotDotToken === undefined) {
			return false;
		}
		return parameter_candidate.type !== undefined;
	}

	/** Responsibilities: _aggregation rest-union contract violation_. **/
	public append_rule(parameter_candidate: ts.Node, rule_context: RuleContextContract): void {
		if (!this.rest_parameter(parameter_candidate)) {
			return;
		}
		if (!ts.isParameter(parameter_candidate)) {
			return;
		}
		if (parameter_candidate.type === undefined) {
			return;
		}
		const aliases = this._imported_aliases.aliases_for(
			parameter_candidate.getSourceFile(),
			rule_context.state().analysis.module_resolver,
			rule_context.state().analysis.source_resolver,
		);
		if (this.contains_union(parameter_candidate.type, aliases, new Set())) {
			rule_context.for_node(parameter_candidate).append_rule(this._rule_id);
		}
	}
}
