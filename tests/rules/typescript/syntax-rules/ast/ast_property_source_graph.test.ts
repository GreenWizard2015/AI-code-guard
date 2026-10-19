import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { AstPropertySourceGraph } from "src/rules/typescript/syntax-rules/ast/ast_property_source_graph";
import { AstPropertySourceIndexCache } from "src/ast_property_source_index_cache";

describe("AST property source graph", () => {
	test("uses the project source resolver for imported files", () => {
		const root = ts.createSourceFile(
			"/project/src/consumer.ts",
			'import { Model } from "./model";\nconst value: Model = {} as Model;\n',
			ts.ScriptTarget.Latest,
			true,
		);
		const imported = ts.createSourceFile("/project/src/model.ts", "interface Model {}", ts.ScriptTarget.Latest, true);
		const graph = new AstPropertySourceGraph(
			root,
			new Map(),
			{ module_symbol: () => "/project/src/model.ts", resolve: () => ({ file: "", name: "" }) },
			new Map([["/project/src/model.ts", imported]]),
			new AstPropertySourceIndexCache(),
		);
		expect(graph.source("/project/src/model.ts")).toBe(imported);
	});

	test("keeps the root source for an unresolved file", () => {
		const root = ts.createSourceFile("/project/src/root.ts", "const value = 1;", ts.ScriptTarget.Latest, true);
		const graph = new AstPropertySourceGraph(
			root,
			new Map(),
			{ module_symbol: () => "", resolve: () => ({ file: "", name: "" }) },
			new Map(),
			new AstPropertySourceIndexCache(),
		);

		expect(graph.source("/project/src/missing.ts")).toBe(root);
	});

	test("loads each re-exported source once in a diamond", () => {
		const root = ts.createSourceFile(
			"/project/src/root.ts",
			'import { A } from "./b0";\nconst value: A = {} as A;\n',
			ts.ScriptTarget.Latest,
			true,
		);
		const sources = new Map<string, ts.SourceFile>([[root.fileName, root]]);
		for (let index = 0; index < 4; index += 1) {
			const next = index + 1;
			let text = `export { A } from \"./b${next}\";\nexport { A as B } from \"./b${next}\";`;
			if (next === 4) {
				text = "export interface A { required: number }";
			}
			sources.set(
				`/project/src/b${index}.ts`,
				ts.createSourceFile(`/project/src/b${index}.ts`, text, ts.ScriptTarget.Latest, true),
			);
		}
		const graph = new AstPropertySourceGraph(
			root,
			new Map(),
			{
				module_symbol: (source, specifier) => {
					if (specifier === "./b0") {
						return "/project/src/b0.ts";
					}
					const match = source.match(/b(\d+)\.ts/u);
					if (match === null) {
						return "";
					}
					const current = Number(match[1]);
					const next = current + 1;
					if (!sources.has(`/project/src/b${next}.ts`)) {
						return "";
					}
					return `/project/src/b${next}.ts`;
				},
				resolve: () => ({ file: "", name: "" }),
			},
			sources,
			new AstPropertySourceIndexCache(),
		);

		expect(graph.source("/project/src/b3.ts").fileName).toBe("/project/src/b3.ts");
	});
});
