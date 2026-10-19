import { describe, expect, test } from "@jest/globals";
import { PythonClassVariableSingletons } from "src/linting/orchestration/runtime/python/python_class_variable_singletons";
import { TestFixture } from "tests/core/test-fixture";

describe("Python singleton class variables", () => {
	test("reports ClassVar through static mapping aliases", () => {
		const file = "mapped-classvar.py";
		const text = [
			"from typing import ClassVar",
			'classvar_key = "classvar"',
			"type_aliases = {classvar_key: ClassVar}",
			"class Registry:",
			"    entries: type_aliases[classvar_key][dict[str, str]] = {}",
		].join("\n");
		const test_fixture = new TestFixture();
		const python_ast_data = test_fixture.python_ast_data();
		const normalized_ast = python_ast_data.source_ast(text);
		const class_variable_rule = new PythonClassVariableSingletons(file, normalized_ast);
		const violations = class_variable_rule.violations();

		expect(violations).toHaveLength(1);
	});

	test("retains imported ClassVar aliases in the resolved alias set", () => {
		const text =
			"from typing import ClassVar as SharedClassValue\nclass Registry:\n    entries: SharedClassValue[int] = {}";
		const test_fixture = new TestFixture();
		const python_ast_data = test_fixture.python_ast_data();
		const normalized_ast = python_ast_data.source_ast(text);
		const class_variable_rule = new PythonClassVariableSingletons("registry.py", normalized_ast);
		const aliases = class_variable_rule.aliases();

		expect(aliases.has("SharedClassValue")).toBe(true);
	});
});
