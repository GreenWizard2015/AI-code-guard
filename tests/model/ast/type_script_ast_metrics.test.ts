import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

describe("TypeScriptAstFile metrics and references", () => {
	test("reports parser diagnostics separately from structural rules", () => {
		const parsed = new TypeScriptAstFile("broken.ts", "export function broken( {");
		const issues = parsed.normalized().parse_issues;

		expect({
			count: issues.length,
			line: issues[0].line,
			has_message: issues[0].message.length > 0,
		}).toEqual({ count: expect.any(Number), line: 0, has_message: true });
	});

	test("counts callable body lines independently from SLOC", () => {
		const parsed = new TypeScriptAstFile(
			"flow.ts",
			[
				"export async function run_edit_flow(",
				"  editor: Editor,",
				"  input: Input",
				"): Promise<Result> {",
				"  // Formatting and comments do not add callable SLOC.",
				"  return execute({ editor, input });",
				"}",
			].join("\n"),
		);

		const functions = parsed.functions();
		const run_function = functions[0];
		expect(run_function).toEqual(expect.objectContaining({ lines: 1, sloc: 2 }));
	});

	test("counts class body lines independently from its declaration", () => {
		const parsed = new TypeScriptAstFile(
			"class-lines.ts",
			[
				"export class Service",
				"  extends Base",
				"  implements Contract {",
				"  run(): void {",
				"    execute();",
				"  }",
				"}",
			].join("\n"),
		);

		const classes = parsed.classes();
		const service_class = classes[0];
		expect(service_class).toEqual(expect.objectContaining({ lines: 3 }));
	});

	test("excludes member documentation from class body line metrics", () => {
		const parsed = new TypeScriptAstFile(
			"class-member-docs.ts",
			[
				"class Service {",
				"  /** Responsibilities: _run the service_. **/",
				"  run(): void {",
				"    execute();",
				"  }",
				"}",
			].join("\n"),
		);

		const classes = parsed.classes();
		const service_class = classes[0];
		expect(service_class).toEqual(expect.objectContaining({ lines: 3 }));
	});

	test("counts nested control statements in callable SLOC", () => {
		const parsed = new TypeScriptAstFile(
			"nested.ts",
			[
				"function walk(items: string[]): void {",
				"  for (const item of items) {",
				"    if (item) return;",
				"  }",
				"}",
			].join("\n"),
		);

		const functions = parsed.functions();
		const walk_function = functions[0];
		expect(walk_function).toEqual(expect.objectContaining({ sloc: 4 }));
	});

	test("keeps normalized reference collections stable across repeated reads", () => {
		const parsed = new TypeScriptAstFile("references.ts", "function read(value: Root): void { value.child.leaf(); }");

		const first = parsed.normalized();
		const second = parsed.normalized();

		expect(second.attribute_accesses).toEqual(first.attribute_accesses);
		expect(second.call_references).toEqual(first.call_references);
	});

	test("collects literal metadata during the shared tree traversal", () => {
		const parsed = new TypeScriptAstFile(
			"literal-metadata.ts",
			['const MESSAGE = "a repeated message value";', 'const result = "a repeated message value";'].join("\n"),
		);

		const metadata = parsed.normalized();
		expect({
			constant_names: metadata.literal_constants.map((item) => item.name),
			references: metadata.literal_references.map((item) => item.value),
		}).toEqual({
			constant_names: ["MESSAGE"],
			references: ["a repeated message value"],
		});
	});

	test("preserves owners through nested property and factory references", () => {
		const parsed = new TypeScriptAstFile(
			"owners.ts",
			[
				"class Leaf { run(): void {} }",
				"class Factory { create(): Leaf { return new Leaf(); } }",
				"const factory = new Factory();",
				"const holder = { leaf: new Leaf() };",
				"const leaf = holder.leaf;",
				"const created = factory.create();",
				"created.run();",
			].join("\n"),
		);

		const calls = parsed.normalized().call_references;
		expect(calls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ owner: "Leaf", name: "run" }),
				expect.objectContaining({ owner: "Factory", name: "create", target_file: "owners.ts" }),
			]),
		);
	});

	test("collects callable references alongside unrelated tree nodes", () => {
		const parsed = new TypeScriptAstFile(
			"reference-candidates.ts",
			[
				"type Label = string;",
				"const count = 1;",
				"function run(service: Service, label: Label): void {",
				"  const current = service;",
				"  service.execute(label);",
				"}",
			].join("\n"),
		);

		const references = parsed.normalized().call_references;
		expect(references.map((reference) => reference.name)).toEqual(["service", "label", "execute"]);
	});

	test("does not inherit a class receiver through an ordinary nested function", () => {
		const parsed = new TypeScriptAstFile(
			"receiver-scope.ts",
			[
				"class Service { execute(): void {} }",
				"class Holder {",
				"  service = new Service();",
				"  run(): void {",
				"    function invoke(): void { this.service.execute(); }",
				"    invoke();",
				"  }",
				"}",
			].join("\n"),
		);

		const execute_references = parsed.normalized().call_references.filter((reference) => reference.name === "execute");

		expect(execute_references).toEqual([expect.objectContaining({ owner: "", target_file: "" })]);
	});

	test("keeps arrow and explicit this receivers bound to their own owners", () => {
		const parsed = new TypeScriptAstFile(
			"typed-receiver-scope.ts",
			[
				"class Service { execute(): void {} }",
				"class OtherHolder { service = new Service(); }",
				"class Holder {",
				"  service = new Service();",
				"  run(): void {",
				"    const invoke_arrow = (): void => this.service.execute();",
				"    function invoke(this: OtherHolder): void { this.service.execute(); }",
				"    invoke.call(new OtherHolder());",
				"  }",
				"}",
			].join("\n"),
		);

		const execute_references = parsed.normalized().call_references.filter((reference) => reference.name === "execute");

		expect(execute_references).toEqual([
			expect.objectContaining({ owner: "Service", target_file: "typed-receiver-scope.ts" }),
			expect.objectContaining({ owner: "Service", target_file: "typed-receiver-scope.ts" }),
		]);
	});

	test("counts a single call in each control-flow body as two SLOC", () => {
		const parsed = new TypeScriptAstFile(
			"control-flow.ts",
			[
				"function conditional(value: boolean): void { if (value) { execute(); } }",
				"function repeated(values: string[]): void { for (const value of values) { execute(value); } }",
				"function guarded(value: boolean): void { while (value) { execute(); } }",
				"function deferred(): void { do { execute(); } while (false); }",
				'function selected(value: string): void { switch (value) { case "a": execute(); break; } }',
				"function conditional_fallback(value: boolean): void { if (value) { execute(); } else { fallback(); } }",
				"function protected_call(): void { try { execute(); } finally { cleanup(); } }",
				"function recovered(): void { try { execute(); } catch (error) { recover(error); } }",
			].join("\n"),
		);

		expect(parsed.functions().map((node) => node.sloc)).toEqual([3, 3, 3, 3, 4, 4, 4, 4]);
	});
});
