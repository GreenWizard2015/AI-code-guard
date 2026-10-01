import ts from "typescript";
import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";

/** Responsibilities: _bare TypeScript aliases identification_, _alias violations addition_. **/
export class TypeScriptBareAlias {
	private readonly alias_rule_id = "typescript-bare-type-alias";
	private readonly reference_type_kind = ts.SyntaxKind.TypeReference;

	/** Responsibilities: _identification aliases reference type_. **/
	private is_reference_alias(statement: ts.TypeAliasDeclaration): boolean {
		if (statement.type.kind !== this.reference_type_kind) {
			return false;
		}
		if (!ts.isTypeReferenceNode(statement.type)) {
			return false;
		}
		return statement.type.typeArguments === undefined;
	}

	/** Responsibilities: _identification aliases unshadowed names_. **/
	private has_unshadowed_name(statement: ts.TypeAliasDeclaration): boolean {
		if (!ts.isTypeReferenceNode(statement.type)) {
			return false;
		}
		const type_name = statement.type.typeName;
		if (!ts.isIdentifier(type_name) && !ts.isQualifiedName(type_name)) {
			return false;
		}
		if (!ts.isIdentifier(type_name)) {
			return true;
		}
		return !statement.typeParameters?.some((parameter) => parameter.name.text === type_name.text);
	}

	/** Responsibilities: _bare alias violation collection_. **/
	private append_alias_violation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node,
	): void {
		if (ts.isTypeAliasDeclaration(node) && this.bare_alias(node)) {
			const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
			const rule = new DiagnosticRule(this.alias_rule_id);
			violations.push(rule.violation(file, line + 1));
		}
		node.forEachChild((child) => this.append_alias_violation(violations, file, source_file, child));
	}

	/** Responsibilities: _aggregation violations bare aliases_. **/
	public append_bare_aliases(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		source_file.forEachChild((node) => this.append_alias_violation(violations, file, source_file, node));
	}

	/** Responsibilities: _reporting type alias bare_. **/
	public bare_alias(statement: ts.TypeAliasDeclaration): boolean {
		if (!this.is_reference_alias(statement)) {
			return false;
		}
		return this.has_unshadowed_name(statement);
	}
}
