import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { TestTargets } from "src/linting/orchestration/runtime/test-targets/test_targets";
import { MockTestPathChecker } from "tests/linting/orchestration/runtime/test-targets/mock_test_path_checker";
import ts from "typescript";

describe("TypeScript test target resolution", () => {
	test("uses imported declarations rather than side-effect imports", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const result = {
			side_effect: targets.valid("tests/bridge/ts/core/module.test.ts", "import 'src/core/module';"),
			class_import: targets.valid("tests/bridge/ts/core/module.test.ts", "import { Module } from 'src/core/module';"),
			type_only_import: targets.valid(
				"tests/bridge/ts/core/module.test.ts",
				"import type { Module } from 'src/core/module';",
			),
			function_import: targets.valid(
				"tests/bridge/ts/core/module.test.ts",
				"import { create_module } from 'src/core/module';",
			),
		};

		expect(result).toEqual({
			side_effect: false,
			class_import: true,
			type_only_import: false,
			function_import: true,
		});
	});

	test("requires a production import and a matching source root", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());

		expect({
			test_import_only: targets.valid(
				"tests/bridge/ts/core/test-targets.test.ts",
				"import 'tests/bridge/ts/core/fixture';",
			),
			wrong_root: targets.valid(
				"tests/bridge/ts/core/test-targets.test.ts",
				"import { Fixture } from 'src/metrics/fixture';",
			),
		}).toEqual({ test_import_only: false, wrong_root: false });
	});

	test("matches root-level modules and the most-used imported declaration", () => {
		const checker = new MockTestPathChecker("/project/src/type_script_module_exports.ts");
		const organization = new TestFileOrganization("/project", checker);
		const targets = new TestTargets("/project", organization, checker);
		const module_result = targets.valid(
			"tests/type_script_module_exports/module-exports.test.ts",
			"import { TypeScriptModuleExports } from 'src/type_script_module_exports';",
		);
		const source = [
			"import { PaymentReader, PaymentWriter } from '@payments/reader-domain';",
			"import { PaymentService } from '@payments/service';",
			"test('uses production declarations', () => {",
			"  new PaymentReader();",
			"  new PaymentReader();",
			"  new PaymentReader();",
			"  new PaymentWriter();",
			"  new PaymentWriter();",
			"  new PaymentWriter();",
			"  new PaymentService();",
			"  new PaymentService();",
			"  new PaymentService();",
			"  new PaymentService();",
			"  new PaymentService();",
			"});",
		].join("\n");

		expect({
			module_directory: module_result,
			less_used_declarations: targets.valid("tests/payments/reader/readers.test.ts", source),
			most_used_declaration: targets.valid("tests/payments/service.test.ts", source),
		}).toEqual({
			module_directory: true,
			less_used_declarations: true,
			most_used_declaration: true,
		});
	});

	test("anchors mixed imports to the most-used imported production class", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const source = [
			"import { PaymentService } from 'src/payments/service';",
			"import { InternalHelper } from 'src/payments/reader/internal_helper';",
			"test('uses the reader', () => {",
			"  new InternalHelper();",
			"  new InternalHelper();",
			"  new InternalHelper();",
			"  new PaymentService();",
			"});",
		].join("\n");

		expect({
			less_used_target: targets.valid("tests/payments/payment-service.test.ts", source),
			most_used_target: targets.valid("tests/payments/reader/internal-helper.test.ts", source),
		}).toEqual({ less_used_target: true, most_used_target: true });
	});

	test("reuses a parsed source file and project resolver aliases", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const source_file = ts.createSourceFile(
			"tests/payments/test_reader.test.ts",
			"import { Reader } from 'src/payments/reader';\nconst value = 1;\n",
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);

		expect({
			alias_import: targets.valid("tests/payments/test_reader.test.ts", "import { Reader } from '@payments/reader';"),
			provided_source: targets.valid_typescript("tests/payments/test_reader.test.ts", source_file),
		}).toEqual({ alias_import: true, provided_source: true });
	});

	test("accepts a configured package alias for a test inside the same production package", () => {
		const checker = new MockTestPathChecker();
		const organization = new TestFileOrganization("/project", checker);
		const targets = new TestTargets("/project", organization, checker);

		expect(
			targets.valid(
				"tests/scripts/webpage/chatgpt-boundaries/opener.test.ts",
				"import { ChatGptThreadOpener } from 'src/scripts/webpage/chatgpt/core/opener';\nnew ChatGptThreadOpener();",
			),
		).toBe(true);
	});

	test("continues after the most-used imported target belongs to another test root", () => {
		const checker = new MockTestPathChecker();
		const organization = new TestFileOrganization("/project", checker);
		const targets = new TestTargets("/project", organization, checker);
		const source = [
			"import { PaymentService } from '@payments/service';",
			"import { PaymentReader } from '@payments/reader-domain';",
			"test('reads a payment', () => {",
			"  new PaymentService();",
			"  new PaymentService();",
			"  new PaymentService();",
			"  new PaymentReader();",
			"});",
		].join("\n");

		expect(targets.valid("tests/payments/reader/payment-reader.test.ts", source)).toBe(true);
	});
});
