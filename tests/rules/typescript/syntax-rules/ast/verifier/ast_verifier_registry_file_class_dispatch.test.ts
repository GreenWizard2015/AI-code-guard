import { describe, expect, test } from "@jest/globals";
import { TypeScriptCompositionModel } from "src/linting/composition/type_script_composition_model";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { TypeScriptDeclarationRules } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_declaration_rules";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("ast verifier registry file class dispatch", () => {
	test("dispatches file-level AST diagnostics through the SourceFile verifier", () => {
		const imports = Array.from({ length: 21 }, (_, index) => `import "module-${index}";`);
		const statements = [
			...imports,
			"import { Item } from 'item';",
			"export { Item };",
			"class Adapter {}",
			"const adapter = new Adapter();",
			"function execute(): void {}",
		];
		const text = statements.join("\n");
		const source_file = ts.createSourceFile("module.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		const rule_ids = new Set(scenario.rule_ids());
		const functions_file = ts.createSourceFile("functions.ts", "type Result = string;", ts.ScriptTarget.Latest, true);
		const functions_scenario = new ASTVerifierTestContext(functions_file);
		functions_scenario.append_tree(registry.build(functions_file.text));
		expect({
			import_fan_out: rule_ids.has("import-fan-out"),
			reexports: rule_ids.has("reexports"),
			singleton: rule_ids.has("singleton"),
			function_placement: rule_ids.has("function-placement"),
			responsibilities: rule_ids.has("responsibilities"),
			function_file_type: functions_scenario.rule_ids().includes("functions-file-type-declaration"),
		}).toEqual({
			import_fan_out: true,
			reexports: true,
			singleton: true,
			function_placement: true,
			responsibilities: true,
			function_file_type: true,
		});
	});

	test("classifies multiline exception bases from syntax and excludes nested classes from module totals", () => {
		const exception_text = "class Reader {}\nclass LocalError\n  extends Error {}";
		const exception_file = ts.createSourceFile("multiline-exception.ts", exception_text, ts.ScriptTarget.Latest, true);
		const exception_registry = new ASTVerifierRegistry();
		exception_registry.initialize();
		const exception_scenario = new ASTVerifierTestContext(exception_file);
		exception_scenario.append_tree(exception_registry.build(exception_text));

		const nested_text = "class Reader {}\nfunction make() { class Nested {} }";
		const nested_file = ts.createSourceFile("nested-class-total.ts", nested_text, ts.ScriptTarget.Latest, true);
		const nested_registry = new ASTVerifierRegistry();
		nested_registry.initialize();
		const nested_scenario = new ASTVerifierTestContext(nested_file);
		nested_scenario.append_tree(nested_registry.build(nested_text));

		expect({
			exception_grouping: exception_scenario.rule_ids().includes("exception-grouping"),
			false_module_class_count: exception_scenario.rule_ids().includes("top-level-classes"),
			nested_class: nested_scenario.rule_ids().includes("nested-class"),
			false_module_nested_class_count: nested_scenario.rule_ids().includes("top-level-classes"),
		}).toEqual({
			exception_grouping: true,
			false_module_class_count: false,
			nested_class: true,
			false_module_nested_class_count: false,
		});
	});

	test("dispatches declaration state diagnostics through declaration nodes", () => {
		const text = [
			"interface Reader { get value(): string; }",
			"class ReaderImpl implements Reader {",
			"  readonly value: string = '';",
			"  public records: string[] = [];",
			"  get value(): string { return ''; }",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("state-diagnostics.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		const counts = new Map<string, number>();
		for (const rule_id of scenario
			.rule_ids()
			.filter((item) => item !== "file-min-size" && item !== "module-protocols-separation")) {
			counts.set(rule_id, (counts.get(rule_id) ?? 0) + 1);
		}

		expect(Object.fromEntries(counts)).toEqual({
			"class-min-size": 1,
			"contract-naming": 1,
			"typescript-contract-getter": 1,
			"typescript-explicit-visibility": 2,
			"typescript-mutable-field": 1,
			"public-field-on-contract-implementation": 2,
			"public-state-exposure": 1,
			responsibilities: 4,
			"typescript-getter": 1,
			"field-in-constructor": 1,
		});
	});

	test("ignores a declaration absent from the request context source index", () => {
		const context_source = ts.createSourceFile("context.ts", "type Existing = string;", ts.ScriptTarget.Latest, true);
		const request_source = ts.createSourceFile("request.ts", "class External {}", ts.ScriptTarget.Latest, true);
		const declaration = request_source.statements.find(ts.isClassDeclaration);
		const context = new ASTVerifierTestContext(context_source);
		const declaration_rules = new TypeScriptDeclarationRules();
		let declaration_verified = false;

		if (declaration !== undefined) {
			declaration_rules.verify({ node: declaration, context });
			declaration_verified = true;
		}

		expect({ declaration_verified, diagnostics: context.rule_ids() }).toEqual({
			declaration_verified: true,
			diagnostics: [],
		});
	});

	test("dispatches getter and setter diagnostics", () => {
		const text = [
			"class Accessors {",
			"  get value(): string { return ''; }",
			"  set value(value: string) {}",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("accessors.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toEqual(expect.arrayContaining(["typescript-getter", "typescript-setter"]));
	});

	test("dispatches class metrics through class declaration nodes", () => {
		const text = "class SmallAdapter { public run(): void {} }";
		const source_file = ts.createSourceFile("class-metrics.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toContain("class-method-min-count");
	});

	test("dispatches constructor dependency limits through class declaration nodes", () => {
		const dependency_classes = Array.from({ length: 6 }, (_, index) => `class Dependency${index} {}`).join("\n");
		const assignments = Array.from(
			{ length: 6 },
			(_, index) => `this.dependency_${index} = new Dependency${index}();`,
		).join("\n");
		const fields = Array.from(
			{ length: 6 },
			(_, index) => `private readonly dependency_${index}: Dependency${index};`,
		).join("\n");
		const text = `${dependency_classes}\nclass Owner { ${fields} constructor() { ${assignments} } }`;
		const source_file = ts.createSourceFile("constructor-dependencies.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));
		const state = scenario.state();
		const model = new TypeScriptCompositionModel(source_file.fileName, source_file, state.analysis.module_resolver);
		const classes = model.classes();

		expect({
			dependencies: classes.filter((item) => item.name === "Owner").flatMap((item) => item.dependencies),
			diagnostic: scenario.rule_ids().includes("constructor-dependency-count"),
		}).toEqual({ dependencies: Array.from({ length: 6 }, (_, index) => `Dependency${index}`), diagnostic: true });
	});

	test("matches anonymous class expressions by AST position on a shared line", () => {
		const dependencies = Array.from({ length: 6 }, (_, index) => `class Dependency${index} {}`).join(" ");
		const fields = Array.from(
			{ length: 6 },
			(_, index) => `private readonly dependency_${index}: Dependency${index};`,
		).join(" ");
		const assignments = Array.from(
			{ length: 6 },
			(_, index) => `this.dependency_${index} = new Dependency${index}();`,
		).join(" ");
		const text = `${dependencies} const first = class {}; const second = class { ${fields} constructor() { ${assignments} } };`;
		const source_file = ts.createSourceFile("anonymous-class-dependencies.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === "constructor-dependency-count")).toHaveLength(1);
	});

	test("matches class metrics to anonymous classes sharing a declaration line", () => {
		const methods = Array.from({ length: 28 }, (_, index) => `run_${index}(): void {}`).join("\n  ");
		const text = `const short = class {}; const long = class {\n  ${methods}\n};`;
		const source_file = ts.createSourceFile("anonymous-class-metrics.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === "class-min-size")).toHaveLength(1);
	});
});
