import type { AstLiteralConstant, AstLiteralReference } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _module literal classification_, _repeated literal grouping_. **/
export class TypeScriptLiteralMetadata {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _constant declaration ownership_. **/
	private constant_name_for(declaration: ts.VariableDeclaration): string {
		if (!ts.isIdentifier(declaration.name)) {
			return "";
		}
		if (!this.const_variable(declaration)) {
			return "";
		}
		if (!declaration.name.text.startsWith(declaration.name.text.toUpperCase())) {
			return "";
		}
		return declaration.name.text;
	}

	/** Responsibilities: _constant declaration validation_. **/
	private const_variable(declaration: ts.VariableDeclaration): boolean {
		const declaration_list = declaration.parent;
		if (!ts.isVariableDeclarationList(declaration_list)) {
			return false;
		}
		const statement = declaration_list.parent;
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		if (statement.parent !== this._source_file) {
			return false;
		}
		return (declaration_list.flags & ts.NodeFlags.Const) !== 0;
	}

	/** Responsibilities: _module literal exclusion_. **/
	private module_literal(parent: ts.Node): boolean {
		if (ts.isImportDeclaration(parent)) {
			return true;
		}
		if (ts.isExportDeclaration(parent)) {
			return true;
		}
		return ts.isExternalModuleReference(parent);
	}

	/** Responsibilities: _literal exclusion classification_. **/
	private excluded_literal(candidate_literal: ts.StringLiteralLike): boolean {
		const parent = candidate_literal.parent;
		if (parent === undefined) {
			return false;
		}
		if (ts.isEnumMember(parent) && parent.initializer === candidate_literal) {
			return true;
		}
		if (this.module_literal(parent) || ts.isLiteralTypeNode(parent)) {
			return true;
		}
		return this.diagnostic_rule_literal(parent, candidate_literal);
	}

	/** Responsibilities: _diagnostic rule literal exclusion_. **/
	private diagnostic_rule_literal(creation: ts.Node, argument: ts.StringLiteralLike): boolean {
		if (!ts.isNewExpression(creation)) {
			return false;
		}
		if (creation.expression.getText(this._source_file) !== "DiagnosticRule") {
			return false;
		}
		const arguments_list = creation.arguments;
		if (arguments_list === undefined) {
			return false;
		}
		return arguments_list.some((candidate) => candidate === argument);
	}

	/** Responsibilities: _literal declaration name lookup_. **/
	private declaration_name(declared_literal: ts.StringLiteralLike): string {
		let current: ts.Node = declared_literal;
		while (current.parent !== undefined) {
			current = current.parent;
			if (ts.isVariableDeclaration(current)) {
				if (current.initializer !== declared_literal) {
					return "";
				}
				return this.constant_name_for(current);
			}
			if (ts.isStatement(current)) {
				return "";
			}
		}
		return "";
	}

	/** Responsibilities: _constant object data classification_. **/
	private constant_object_value(declared_literal: ts.StringLiteralLike): boolean {
		let current: ts.Node = declared_literal;
		while (current.parent !== undefined) {
			current = current.parent;
			if (ts.isVariableDeclaration(current)) {
				return current.initializer !== declared_literal && this.constant_name_for(current).length > 0;
			}
			if (ts.isStatement(current)) {
				return false;
			}
		}
		return false;
	}

	/** Responsibilities: _literal metadata initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _literal metadata accumulation_. **/
	public append(
		recorded_literal: ts.StringLiteralLike,
		line: number,
		references: AstLiteralReference[],
		constants: AstLiteralConstant[],
	): void {
		if (recorded_literal.text.length < 8) {
			return;
		}
		if (this.excluded_literal(recorded_literal)) {
			return;
		}
		if (this.constant_object_value(recorded_literal)) {
			return;
		}
		const value = recorded_literal.text;
		const name = this.declaration_name(recorded_literal);
		if (name.length === 0) {
			references.push({ value, line });
			return;
		}
		constants.push({ value, name, line });
	}

	/** Responsibilities: _literal metadata node dispatch_. **/
	public append_node(
		candidate: ts.Node,
		line: number,
		references: AstLiteralReference[],
		constants: AstLiteralConstant[],
	): void {
		switch (candidate.kind) {
			case ts.SyntaxKind.StringLiteral:
				if (ts.isStringLiteral(candidate)) {
					this.append(candidate, line, references, constants);
				}
				break;
			case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
				if (ts.isNoSubstitutionTemplateLiteral(candidate)) {
					this.append(candidate, line, references, constants);
				}
				break;
			default:
				break;
		}
	}
}
