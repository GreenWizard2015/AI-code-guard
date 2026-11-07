import { describe, expect, test } from "@jest/globals";
import { DuplicateTypeShapes } from "src/duplicate_type_shapes";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptTypeShapeCollector } from "src/rules/typescript/syntax-rules/types/type_script_type_shape_collector";
import ts from "typescript";

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

	test("collects interface and object alias fields", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			"interface RecordShape { id: string; } type LabelShape = { label: string; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const collector = new TypeScriptTypeShapeCollector(source_file);
		const shapes = collector.collect();

		expect(shapes.map((shape) => [shape.name, shape.fields])).toEqual([
			["RecordShape", ["id:string"]],
			["LabelShape", ["label:string"]],
		]);
	});

	test("collects interface bases independently from alias fields", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			"interface BaseShape {} interface ChildShape extends BaseShape { value: number; } type AliasShape = { value: number; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const collector = new TypeScriptTypeShapeCollector(source_file);
		const shapes = collector.collect();

		expect(shapes.map((shape) => [shape.name, shape.base_names])).toEqual([
			["ChildShape", ["BaseShape"]],
			["AliasShape", []],
		]);
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

	test("keeps optional and required fields distinct", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			"type RequiredShape = { value: string }; type OptionalShape = { value?: string };",
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const duplicates = duplicate_shapes.typescript(source_file);

		expect(duplicates).toEqual([]);
	});

	test("keeps generic interface base arguments distinct", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			"interface StringBase<T> {} interface StringShape extends StringBase<string> { value: string; } interface NumberShape extends StringBase<number> { value: string; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const duplicates = duplicate_shapes.typescript(source_file);

		expect(duplicates).toEqual([]);
	});

	test("reuses immutable TypeScript duplicate results for the same AST", () => {
		const source_file = ts.createSourceFile(
			"types.ts",
			"type Left = { value: string }; type Right = { value: string };",
			ts.ScriptTarget.Latest,
			true,
		);
		const duplicate_shapes = new DuplicateTypeShapes();
		const first = duplicate_shapes.typescript(source_file);
		const repeated = duplicate_shapes.typescript(source_file);

		expect({ same_result: repeated === first, immutable: Object.isFrozen(repeated) }).toEqual({
			same_result: true,
			immutable: true,
		});
	});

	test("reuses Python duplicate results for the same class collection", () => {
		const classes: readonly AstClassNode[] = [];
		const duplicate_shapes = new DuplicateTypeShapes();
		const first = duplicate_shapes.python(classes);
		const repeated = duplicate_shapes.python(classes);

		expect({ same_result: repeated === first, immutable: Object.isFrozen(repeated) }).toEqual({
			same_result: true,
			immutable: true,
		});
	});
});
