import ts from "typescript";
import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";

/** Responsibilities: _dictionary contract reporting_. **/
export class DictionaryReturns {
	private readonly dictionary_rule_id = "typescript-dictionary-return";

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

	/** Responsibilities: _nested alias declaration collection_. **/
	private collect_type_aliases(node: ts.Node, aliases: ts.TypeAliasDeclaration[]): void {
		if (ts.isTypeAliasDeclaration(node)) {
			aliases.push(node);
		}
		node.forEachChild((child) => this.collect_type_aliases(child, aliases));
	}

	/** Responsibilities: _source alias declaration collection_. **/
	private type_aliases(source_file: ts.SourceFile): readonly ts.TypeAliasDeclaration[] {
		const aliases: ts.TypeAliasDeclaration[] = [];
		this.collect_type_aliases(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _aggregation dictionary result violation_. **/
	private append_dictionary_return(
		violations: Violation[],
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
	public dictionary_types(source_file: ts.SourceFile): Set<string> {
		const types = new Set<string>();
		const aliases = this.type_aliases(source_file);
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
	public dictionary_return_info(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		const types = this.dictionary_types(source_file);
		const visit = (node: ts.Node): void => {
			this.append_dictionary_return(violations, file, source_file, types, node);
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}
}
