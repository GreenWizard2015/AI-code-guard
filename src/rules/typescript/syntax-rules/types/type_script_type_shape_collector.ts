import type { NamedShape } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _TypeScript type shape extraction_, _source file ownership_. **/
export class TypeScriptTypeShapeCollector {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _declaration members_. **/
	private members(statement: ts.Node): readonly ts.TypeElement[] {
		if (ts.isInterfaceDeclaration(statement)) {
			return statement.members;
		}
		if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
			return statement.type.members;
		}
		return [];
	}

	/** Responsibilities: _property field shapes_. **/
	private fields(members: readonly ts.TypeElement[]): string[] {
		return members
			.map((member) => {
				if (!ts.isPropertySignature(member) || member.name === undefined) {
					return "";
				}
				let type = "";
				if (member.type !== undefined) {
					type = member.type.getText(this._source_file);
				}
				const optional = member.questionToken === undefined ? "" : "?";
				const modifiers = member.modifiers;
				let readonly = "";
				if (modifiers !== undefined && modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) {
					readonly = "readonly ";
				}
				return `${readonly}${member.name.getText(this._source_file)}${optional}:${type}`;
			})
			.filter((field) => field !== "");
	}

	/** Responsibilities: _interface base names_. **/
	private base_names(statement: ts.InterfaceDeclaration): string[] {
		if (statement.heritageClauses === undefined) {
			return [];
		}
		return statement.heritageClauses
			.filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
			.flatMap((clause) => clause.types.map((type) => type.getText(this._source_file)));
	}

	/** Responsibilities: _source file ownership_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _declaration shape extraction_. **/
	public collect_type(statement: ts.Node): readonly NamedShape[] {
		if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
			return [];
		}
		const members = this.members(statement);
		if (members.length === 0) {
			return [];
		}
		const line = this._source_file.getLineAndCharacterOfPosition(statement.getStart(this._source_file)).line + 1;
		let base_names: string[] = [];
		if (ts.isInterfaceDeclaration(statement)) {
			base_names = this.base_names(statement);
		}
		return [{ name: statement.name.text, line, fields: this.fields(members), base_names }];
	}

	/** Responsibilities: _type shape traversal_. **/
	public collect(): NamedShape[] {
		const shapes: NamedShape[] = [];
		const visit = (declaration: ts.Node): void => {
			const declaration_shapes = this.collect_type(declaration);
			shapes.push(...declaration_shapes);
			declaration.forEachChild(visit);
		};
		visit(this._source_file);
		return shapes;
	}
}
