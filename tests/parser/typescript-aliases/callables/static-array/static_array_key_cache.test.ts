import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticArrayKeys } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_keys";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("static array declaration index reuse", () => {
	const source_file = ts.createSourceFile(
		"array-index-cache.ts",
		'const ArrayFactory = Array; const items = ArrayFactory.of("kept");',
		ts.ScriptTarget.Latest,
		true,
	);
	let query: ts.Expression = ts.factory.createIdentifier("missing");
	for (const statement of source_file.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name)) {
				continue;
			}
			if (declaration.name.text !== "items") {
				continue;
			}
			if (declaration.initializer !== undefined) {
				query = declaration.initializer;
			}
		}
	}
	test("resolves values through an aliased Array factory", () => {
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const keys = new TypeScriptStaticArrayKeys(declaration_index);
		const value = keys.value(query, source_file);

		expect(value).toBe("kept");
	});
	test("shares source declaration indexing across independent key resolvers", () => {
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const first = new TypeScriptStaticArrayKeys(declaration_index);
		const second = new TypeScriptStaticArrayKeys(declaration_index);

		expect([first.value(query, source_file), second.value(query, source_file)]).toEqual(["kept", "kept"]);
	});

	test("preserves direct and spread literal element order", () => {
		const source = ts.createSourceFile("literal-arrays.ts", "", ts.ScriptTarget.Latest, true);
		const direct = ts.factory.createArrayLiteralExpression([
			ts.factory.createStringLiteral("first"),
			ts.factory.createStringLiteral("last"),
		]);
		const spread = ts.factory.createArrayLiteralExpression([
			ts.factory.createStringLiteral("before"),
			ts.factory.createSpreadElement(
				ts.factory.createArrayLiteralExpression([ts.factory.createStringLiteral("middle")]),
			),
			ts.factory.createStringLiteral("after"),
		]);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const keys = new TypeScriptStaticArrayKeys(declaration_index);
		const direct_values = keys.expressions(direct, source);
		const spread_values = keys.expressions(spread, source);

		expect({
			direct: direct_values.map((expression) => ts.isStringLiteral(expression) && expression.text),
			spread: spread_values.map((expression) => ts.isStringLiteral(expression) && expression.text),
		}).toEqual({ direct: ["first", "last"], spread: ["before", "middle", "after"] });
	});

	test("reuses the collected declarations for the same source scope", () => {
		const index = new TypeScriptObjectAliasDeclarationIndex();
		const first = index.declarations(source_file);
		const second = index.declarations(source_file);

		expect({ declaration_count: first.length, same_inventory: first === second }).toEqual({
			declaration_count: 2,
			same_inventory: true,
		});
	});

	test("reuses the immutable expression result for the same AST node", () => {
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const keys = new TypeScriptStaticArrayKeys(declaration_index);
		const first = keys.expressions(query, source_file);
		const second = keys.expressions(query, source_file);
		const values = first.map((expression) => expression.getText(source_file));

		expect({
			same_result: second === first,
			values,
			immutable: Object.isFrozen(first),
		}).toEqual({ same_result: true, values: ['"kept"'], immutable: true });
	});

	test("resolves forward array aliases through repeated declaration passes", () => {
		const forward_file = ts.createSourceFile(
			"forward-array-alias.ts",
			'const key_source = Array.from(last); const last = middle; const middle = ["forward"];',
			ts.ScriptTarget.Latest,
			true,
		);
		const first_statement = forward_file.statements.at(0);
		let initializer: ts.Expression | undefined;
		if (first_statement !== undefined && ts.isVariableStatement(first_statement)) {
			const declarations = first_statement.declarationList.declarations;
			const first_declaration = declarations.at(0);
			if (first_declaration !== undefined) {
				initializer = first_declaration.initializer;
			}
		}
		let value = "";
		if (initializer !== undefined) {
			const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
			const keys = new TypeScriptStaticArrayKeys(declaration_index);
			value = keys.value(initializer, forward_file);
		}

		expect(value).toBe("forward");
	});
});
