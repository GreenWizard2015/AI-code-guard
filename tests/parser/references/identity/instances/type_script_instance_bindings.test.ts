import { describe, expect, test } from "@jest/globals";
import { TypeScriptInstanceBindings } from "src/parser/references/identity/instances/type_script_instance_bindings";
import { TypeScriptInstanceIndex } from "src/parser/references/identity/instances/type_script_instance_index";
import ts from "typescript";

describe("TypeScript instance bindings", () => {
	test("preserves insertion order for bindings with the same scoped name", () => {
		const bindings = new TypeScriptInstanceBindings();
		const source = ts.createSourceFile(
			"bindings.ts",
			"const first = 1; const second = 2;",
			ts.ScriptTarget.Latest,
			true,
		);
		const first_declaration = source.statements[0];
		const second_declaration = source.statements[1];
		const first_scope = ts.factory.createBlock([], false);
		const first_node = first_declaration ?? source;
		const second_node = second_declaration ?? source;
		bindings.add(first_scope, "value", first_node, "FirstOwner");
		bindings.add(first_scope, "value", second_node, "SecondOwner");

		expect(bindings.bindings(first_scope, "value")).toEqual([
			{ start: first_node.getStart(source), owner: "FirstOwner" },
			{ start: second_node.getStart(source), owner: "SecondOwner" },
		]);
	});

	test("isolates names by lexical scope and returns no bindings for missing names", () => {
		const bindings = new TypeScriptInstanceBindings();
		const first_scope = ts.factory.createBlock([], false);
		const second_scope = ts.factory.createBlock([], false);
		const source = ts.createSourceFile("bindings.ts", "const value = 1;", ts.ScriptTarget.Latest, true);
		const declaration = source.statements[0] ?? source;
		bindings.add(first_scope, "value", declaration, "FirstOwner");
		bindings.add(second_scope, "value", declaration, "SecondOwner");

		expect({
			first_scope: bindings.bindings(first_scope, "value"),
			second_scope: bindings.bindings(second_scope, "value"),
			missing_name: bindings.bindings(first_scope, "missing"),
		}).toEqual({
			first_scope: [{ start: declaration.getStart(source), owner: "FirstOwner" }],
			second_scope: [{ start: declaration.getStart(source), owner: "SecondOwner" }],
			missing_name: [],
		});
	});

	test("resolves imported owners by name and preserves empty owners", () => {
		const index_source = ts.createSourceFile("imports.ts", "const value = 1;", ts.ScriptTarget.Latest, true);
		const index = new TypeScriptInstanceIndex(index_source);
		const reference = index_source.statements[0] ?? index_source;
		index.add("external", "ImportedOwner");
		index.add("empty", "");

		expect({
			external: index.instance_owner("external", reference),
			empty: index.instance_owner("empty", reference),
			missing: index.instance_owner("missing", reference),
		}).toEqual({
			external: { bound: true, value: "ImportedOwner" },
			empty: { bound: true, value: "" },
			missing: { bound: false, value: "" },
		});
	});

	test("keeps a local binding ahead of an imported owner with the same name", () => {
		const source = ts.createSourceFile("shadowed.ts", "const shadowed = 1;\nshadowed;", ts.ScriptTarget.Latest, true);
		const declaration = source.statements.find(ts.isVariableStatement);
		const reference = source.statements.find(ts.isExpressionStatement);
		const index = new TypeScriptInstanceIndex(source);
		if (declaration !== undefined) {
			index.add("shadowed", "LocalOwner", declaration);
		}
		index.add("shadowed", "ImportedOwner");
		let local_owner = { bound: false, value: "" };
		if (reference !== undefined) {
			local_owner = index.instance_owner("shadowed", reference.expression);
		}
		expect(local_owner).toEqual({
			bound: true,
			value: "LocalOwner",
		});
	});
});
