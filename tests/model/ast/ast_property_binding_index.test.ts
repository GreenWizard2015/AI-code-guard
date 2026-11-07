import { describe, expect, test } from "@jest/globals";
import { AstPropertyBindingIndex } from "src/model/ast/ast_property_binding_index";
import ts from "typescript";

describe("AstPropertyBindingIndex", () => {
	test("returns an explicitly declared variable type", () => {
		const source = ts.createSourceFile(
			"bindings.ts",
			"const typed_value: string = 'value';",
			ts.ScriptTarget.Latest,
			true,
		);
		const statement = source.statements[0];
		let resolved_type = "";
		const unknown_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
		if (statement && ts.isVariableStatement(statement)) {
			const declaration = statement.declarationList.declarations[0];
			if (declaration && ts.isIdentifier(declaration.name)) {
				const index = new AstPropertyBindingIndex();
				index.register(source, declaration);
				resolved_type = index.type(declaration.name, unknown_type).getText(source);
			}
		}

		expect(resolved_type).toBe("string");
	});

	test("resolves a variable alias to its declared type", () => {
		const source = ts.createSourceFile(
			"bindings.ts",
			"const typed_value: string = 'value'; const alias_value = typed_value;",
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = source.statements
			.filter(ts.isVariableStatement)
			.flatMap((statement) => [...statement.declarationList.declarations]);
		const typed_declaration = declarations[0];
		const alias_declaration = declarations[1];
		const index = new AstPropertyBindingIndex();
		const unknown_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
		let resolved_type = "";
		if (typed_declaration && alias_declaration && ts.isIdentifier(alias_declaration.name)) {
			index.register(source, typed_declaration);
			index.register(source, alias_declaration);
			resolved_type = index.type(alias_declaration.name, unknown_type).getText(source);
		}

		expect(resolved_type).toBe("string");
	});
});
