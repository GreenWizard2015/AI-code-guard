import { describe, expect, test } from "@jest/globals";
import { TypeScriptDeclarationMatcher } from "src/core/project-source/type_script_declaration_matcher";
import ts from "typescript";

describe("TypeScript declaration matcher", () => {
	test("matches classes and functions by their declared name", () => {
		const source = ts.createSourceFile(
			"declarations.ts",
			"class Service {} function load() {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const service = new TypeScriptDeclarationMatcher("Service");
		const load = new TypeScriptDeclarationMatcher("load");

		expect({
			classes: source.statements
				.filter(ts.isClassDeclaration)
				.map((declaration) => service.matches_declaration(declaration)),
			functions: source.statements
				.filter(ts.isFunctionDeclaration)
				.map((declaration) => load.matches_declaration(declaration)),
		}).toEqual({ classes: [true], functions: [true] });
		expect([service.matches_source(source), load.matches_source(source)]).toEqual([true, true]);
	});

	test("matches function-valued variables but not ordinary variables", () => {
		const source = ts.createSourceFile(
			"declarations.ts",
			"const load = () => {}; const value = 1;",
			ts.ScriptTarget.Latest,
			true,
		);
		const matcher = new TypeScriptDeclarationMatcher("load");
		const non_function = new TypeScriptDeclarationMatcher("value");

		const declarations = source.statements.filter(ts.isVariableStatement);
		expect({
			load: declarations.map((declaration) => matcher.matches_declaration(declaration)),
			value: declarations.map((declaration) => non_function.matches_declaration(declaration)),
		}).toEqual({ load: [true, false], value: [false, false] });
	});

	test("does not match declarations with a different name", () => {
		const source = ts.createSourceFile("declarations.ts", "function load() {}", ts.ScriptTarget.Latest, true);
		const matcher = new TypeScriptDeclarationMatcher("save");

		expect(
			source.statements.filter(ts.isFunctionDeclaration).map((declaration) => matcher.matches_declaration(declaration)),
		).toEqual([false]);
	});
});
