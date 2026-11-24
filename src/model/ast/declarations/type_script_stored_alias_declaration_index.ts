import type { StoredAliasDeclarationIndexContract, StoredAliasNames } from "src/parser/analysis/protocols";
import type { SourceAliasLookupCache } from "src/parser/types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _source member alias matching_, _alias cache ownership_. **/
export class TypeScriptStoredAliasDeclarationIndex implements StoredAliasDeclarationIndexContract {
	private readonly _present_aliases: SourceAliasLookupCache;
	private readonly _absent_aliases: SourceAliasLookupCache;

	/** Responsibilities: _static member name resolution_. **/
	private static_member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _variable alias declaration match_. **/
	private variable_alias(variable_candidate: ts.Node, names: StoredAliasNames): boolean {
		if (!ts.isVariableDeclaration(variable_candidate) || !ts.isIdentifier(variable_candidate.name)) {
			return false;
		}
		if (variable_candidate.name.text !== names.expression_name || variable_candidate.initializer === undefined) {
			return false;
		}
		return this.static_member_name(variable_candidate.initializer) === names.property_name;
	}

	/** Responsibilities: _source tree alias lookup_. **/
	private alias_declaration(candidate_node: ts.Node, names: StoredAliasNames): boolean {
		if (this.variable_alias(candidate_node, names)) {
			return true;
		}
		let found = false;
		candidate_node.forEachChild((child) => {
			if (!found && this.alias_declaration(child, names)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _alias result cache update_. **/
	private cache_alias(source_file: ts.SourceFile, key: string, result: boolean): void {
		const cache = this.alias_cache(result);
		let names = cache.get(source_file);
		if (names === undefined) {
			names = new Set();
			cache.set(source_file, names);
		}
		names.add(key);
	}

	/** Responsibilities: _alias cache choice_. **/
	private alias_cache(result: boolean): SourceAliasLookupCache {
		if (result) {
			return this._present_aliases;
		}
		return this._absent_aliases;
	}

	/** Responsibilities: _source alias cache initialization_. **/
	public constructor() {
		this._present_aliases = new WeakMap();
		this._absent_aliases = new WeakMap();
	}

	/** Responsibilities: _member alias property matching_. **/
	public member_alias_property(
		expression: ts.Expression,
		member_node: ts.Node,
		name: string,
		member_aliases: TypeScriptMemberAliasesContract,
	): boolean {
		if (member_aliases.property({ expression, node: member_node, name })) {
			return true;
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.source_has_alias(member_node.getSourceFile(), expression.text, name);
	}

	/** Responsibilities: _source alias lookup_. **/
	public source_has_alias(source_file: ts.SourceFile, expression_name: string, property_name: string): boolean {
		const key = JSON.stringify([expression_name, property_name]);
		const present = this._present_aliases.get(source_file);
		if (present !== undefined) {
			if (present.has(key)) {
				return true;
			}
		}
		const absent = this._absent_aliases.get(source_file);
		if (absent !== undefined) {
			if (absent.has(key)) {
				return false;
			}
		}
		const result = this.alias_declaration(source_file, { expression_name, property_name });
		this.cache_alias(source_file, key, result);
		return result;
	}
}
