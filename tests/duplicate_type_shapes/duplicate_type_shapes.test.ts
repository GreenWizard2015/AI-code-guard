import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { DuplicateTypeShapes } from "src/duplicate_type_shapes";

describe("coding-lint duplicate type shapes", () => {
	test("reports duplicate top-level type shapes", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			["type Left = { value: string; label: string };", "type Right = { value: string; label: string };"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const duplicates = duplicate_shapes.typescript(source_file);

		expect(duplicates).toEqual([{ line: 1, names: ["Left", "Right"] }]);
	});

	test("reports duplicate type shapes nested in namespaces", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			[
				"namespace ValueTypes {",
				"  export type Left = { value: string; label: string };",
				"  export type Right = { value: string; label: string };",
				"}",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const duplicates = duplicate_shapes.typescript(source_file);

		expect(duplicates).toEqual([{ line: 2, names: ["Left", "Right"] }]);
	});

	test("reports duplicate interfaces nested in namespaces", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			[
				"namespace ValueTypes {",
				"  export interface Left { value: string; label: string; }",
				"  export interface Right { value: string; label: string; }",
				"}",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const duplicates = duplicate_shapes.typescript(source_file);

		expect(duplicates).toEqual([{ line: 2, names: ["Left", "Right"] }]);
	});
});
