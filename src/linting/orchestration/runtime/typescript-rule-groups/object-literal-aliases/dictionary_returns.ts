import ts from "typescript";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _dictionary types_, _object results_. **/
export class DictionaryReturns {
	private readonly dictionary_rule_id = RULE_IDS.typescript_dictionary_return;

	/** Responsibilities: _classification type member represents_. **/
	private is_behavior_member(member: ts.TypeElement): boolean {
		if (ts.isMethodSignature(member)) {
			return true;
		}
		return ts.isCallSignatureDeclaration(member);
	}

	/** Responsibilities: _resolution type reference name_. **/
	private type_reference_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
	}

	/** Responsibilities: _collection dictionary type alias_. **/
	private append_dictionary_alias(types: Set<string>, statement: ts.Statement): boolean {
		if (!ts.isTypeAliasDeclaration(statement)) {
			return false;
		}
		if (!this.type_contains_dictionary(statement.type, types) || types.has(statement.name.text)) {
			return false;
		}
		types.add(statement.name.text);
		return true;
	}

	/** Responsibilities: _collection direct dictionary type_. **/
	private append_dictionary_type(types: Set<string>, statement: ts.Statement): void {
		if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeLiteralNode(statement.type)) {
			return;
		}
		if (statement.type.members.some((member) => this.is_behavior_member(member))) {
			types.add(statement.name.text);
		}
	}

	/** Responsibilities: _classification dictionary type reference_. **/
	private type_reference_dictionary(type: ts.TypeReferenceNode, types: ReadonlySet<string>): boolean {
		if (types.has(this.type_reference_name(type.typeName))) {
			return true;
		}
		const arguments_ = type.typeArguments;
		if (arguments_ === undefined) {
			return false;
		}
		return arguments_.some((argument) => this.type_contains_dictionary(argument, types));
	}

	/** Responsibilities: _classification wrapped dictionary type_. **/
	private type_contains_dictionary(type: ts.TypeNode, types: ReadonlySet<string>): boolean {
		if (ts.isTypeReferenceNode(type)) {
			return this.type_reference_dictionary(type, types);
		}
		if (ts.isArrayTypeNode(type)) {
			return this.type_contains_dictionary(type.elementType, types);
		}
		if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
			return type.types.some((item) => this.type_contains_dictionary(item, types));
		}
		if (ts.isTypeOperatorNode(type) || ts.isParenthesizedTypeNode(type)) {
			return this.type_contains_dictionary(type.type, types);
		}
		return false;
	}

	/** Responsibilities: _aggregation dictionary result violation_. **/
	private append_dictionary_return(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		types: Set<string>,
		node: ts.Node,
	): void {
		if (!this.is_dictionary_return(node, types)) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		const rule = new DiagnosticRule(this.dictionary_rule_id);
		violations.push(rule.violation(file, line));
	}

	/** Responsibilities: _classification statement output inline_. **/
	private is_dictionary_return(node: ts.Node, types: Set<string>): boolean {
		if (!ts.isFunctionLike(node) || !node.type) {
			return false;
		}
		return this.type_contains_dictionary(node.type, types);
	}

	/** Responsibilities: _collection names dictionary-shaped type_. **/
	public dictionary_types(aliases: readonly ts.TypeAliasDeclaration[]): Set<string> {
		const types = new Set<string>();
		for (const alias of aliases) {
			this.append_dictionary_type(types, alias);
		}
		let changed = true;
		while (changed) {
			changed = false;
			for (const alias of aliases) {
				if (this.append_dictionary_alias(types, alias)) {
					changed = true;
				}
			}
		}
		return types;
	}

	/** Responsibilities: _collection dictionary result violations_. **/
	public dictionary_return_info(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void {
		const types = this.dictionary_types(index.type_aliases);
		for (const node of index.function_like) {
			this.append_dictionary_return(violations, file, source_file, types, node);
		}
	}
}
