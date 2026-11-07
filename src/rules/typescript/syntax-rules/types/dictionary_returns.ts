import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { DictionaryNameIndex } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _dictionary return classification_, _dictionary return diagnostics_. **/
export class DictionaryReturns implements ASTSourceRuleContract {
	private readonly _names_by_source: DictionaryNameIndex;

	/** Responsibilities: _dictionary type literal classification_. **/
	private dictionary_literal(type: ts.TypeNode): boolean {
		if (!ts.isTypeLiteralNode(type)) {
			return false;
		}
		return type.members.some((member) => ts.isMethodSignature(member) || ts.isCallSignatureDeclaration(member));
	}

	/** Responsibilities: _dictionary type alias discovery_. **/
	private type_aliases(source_file: ts.SourceFile): ts.TypeAliasDeclaration[] {
		const aliases: ts.TypeAliasDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isTypeAliasDeclaration(node)) {
				aliases.push(node);
			}
			node.forEachChild(visit);
		};
		visit(source_file);
		return aliases;
	}

	/** Responsibilities: _rightmost imported type name_. **/
	private rightmost_type_name(name: ts.EntityName): string {
		if (ts.isIdentifier(name)) {
			return name.text;
		}
		return name.right.text;
	}

	/** Responsibilities: _dictionary type reference resolution_. **/
	private type_reference_dictionary(type: ts.TypeReferenceNode, names: ReadonlySet<string>): boolean {
		const name = this.rightmost_type_name(type.typeName);
		if (names.has(name)) {
			return true;
		}
		if (type.typeArguments === undefined) {
			return false;
		}
		for (const argument of type.typeArguments) {
			if (this.type_contains_dictionary(argument, names)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _nested dictionary type detection_. **/
	private type_contains_dictionary(type: ts.TypeNode, names: ReadonlySet<string>): boolean {
		if (this.dictionary_literal(type)) {
			return true;
		}
		if (ts.isTypeReferenceNode(type)) {
			return this.type_reference_dictionary(type, names);
		}
		if (ts.isArrayTypeNode(type)) {
			return this.type_contains_dictionary(type.elementType, names);
		}
		if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
			return type.types.some((item) => this.type_contains_dictionary(item, names));
		}
		if (ts.isTypeOperatorNode(type) || ts.isParenthesizedTypeNode(type)) {
			return this.type_contains_dictionary(type.type, names);
		}
		return false;
	}

	/** Responsibilities: _initial dictionary alias names_. **/
	private initial_dictionary_names(aliases: readonly ts.TypeAliasDeclaration[]): Set<string> {
		const names = new Set<string>();
		for (const alias of aliases) {
			if (this.dictionary_literal(alias.type)) {
				names.add(alias.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _dictionary alias dependency expansion_. **/
	private append_dictionary_aliases(aliases: readonly ts.TypeAliasDeclaration[], names: Set<string>): boolean {
		let changed = false;
		for (const alias of aliases) {
			if (names.has(alias.name.text)) {
				continue;
			}
			if (!this.type_contains_dictionary(alias.type, names)) {
				continue;
			}
			names.add(alias.name.text);
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _per-file dictionary type index_. **/
	private dictionary_types(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached = this._names_by_source.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = this.type_aliases(source_file);
		const names = this.initial_dictionary_names(aliases);
		let changed = true;
		while (changed) {
			changed = this.append_dictionary_aliases(aliases, names);
		}
		this._names_by_source.set(source_file, names);
		return names;
	}

	/** Responsibilities: _function return type diagnostics_. **/
	private append_return(node: ts.Node, context: RuleContextContract): void {
		if (!ts.isFunctionLike(node) || node.type === undefined) {
			return;
		}
		const source_file = context.state().source.source_file;
		const names = this.dictionary_types(source_file);
		if (this.type_contains_dictionary(node.type, names)) {
			context.for_node(node).append_rule(RULE_IDS.typescript_dictionary_return);
		}
	}

	/** Responsibilities: _dictionary return verifier initialization_. **/
	public constructor() {
		this._names_by_source = new WeakMap();
	}

	/** Responsibilities: _dictionary return rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _dictionary return node dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		this.append_return(request.node, request.context);
	}
}
