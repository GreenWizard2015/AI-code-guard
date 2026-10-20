import ts from "typescript";
import type { SourceLineResolver } from "src/runtime_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { AstLiteralConstant, AstLiteralReference } from "src/types";
import type { TypeScriptLiteralMetadataResult } from "src/model/types";

/** Responsibilities: _module literal classification_, _repeated literal grouping_. **/
export class TypeScriptLiteralMetadata {
	private readonly source_file: ts.SourceFile;
	private readonly traversal: TypeScriptAstTraversalContract;

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

	/** Responsibilities: _constant declaration ownership_. **/
	private constant_name(node: ts.Node): string {
		let current: ts.Node = node;
		while (current.parent !== undefined) {
			current = current.parent;
			if (ts.isVariableDeclaration(current)) {
				return this.constant_name_for(current);
			}
			if (ts.isStatement(current)) {
				return "";
			}
		}
		return "";
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
		if (statement.parent !== this.source_file) {
			return false;
		}
		return (declaration_list.flags & ts.NodeFlags.Const) !== 0;
	}

	/** Responsibilities: _literal exclusion_. **/
	private excluded(node: ts.Node): boolean {
		if (node.parent === undefined) {
			return false;
		}
		if (ts.isEnumMember(node.parent)) {
			return node.parent.initializer === node;
		}
		if (this.module_literal(node.parent)) {
			return true;
		}
		if (this.diagnostic_literal(node)) {
			return true;
		}
		return ts.isLiteralTypeNode(node.parent);
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

	/** Responsibilities: _diagnostic rule literal exclusion_. **/
	private diagnostic_literal(node: ts.Node): boolean {
		const parent = node.parent;
		if (parent === undefined) {
			return false;
		}
		if (!ts.isNewExpression(parent)) {
			return false;
		}
		if (parent.expression.getText(this.source_file) !== "DiagnosticRule") {
			return false;
		}
		const arguments_list = parent.arguments;
		if (arguments_list === undefined) {
			return false;
		}
		return arguments_list.some((argument) => argument === node);
	}

	/** Responsibilities: _literal metadata initialization_. **/
	public constructor(source_file: ts.SourceFile, traversal: TypeScriptAstTraversalContract) {
		this.source_file = source_file;
		this.traversal = traversal;
	}

	/** Responsibilities: _literal value classification_. **/
	public literal_value(node: ts.Node): string {
		if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
			return "";
		}
		if (node.text.length < 8) {
			return "";
		}
		if (this.excluded(node)) {
			return "";
		}
		return node.text;
	}

	/** Responsibilities: _literal metadata accumulation_. **/
	public append(
		node: ts.Node,
		line_for: SourceLineResolver,
		references: AstLiteralReference[],
		constants: AstLiteralConstant[],
	): void {
		const value = this.literal_value(node);
		if (value.length === 0) {
			return;
		}
		const line = line_for(node.getStart(this.source_file));
		const name = this.constant_name(node);
		if (name.length === 0) {
			references.push({ value, line });
			return;
		}
		constants.push({ value, name, line });
	}

	/** Responsibilities: _literal metadata collection_. **/
	public collect(line_for: SourceLineResolver): TypeScriptLiteralMetadataResult {
		const references: AstLiteralReference[] = [];
		const constants: AstLiteralConstant[] = [];
		this.traversal.visit((node) => {
			if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
				this.append(node, line_for, references, constants);
			}
		});
		return { references, constants };
	}
}
