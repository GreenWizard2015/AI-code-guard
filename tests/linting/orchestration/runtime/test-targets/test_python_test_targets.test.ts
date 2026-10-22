import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { TestTargetRoots } from "src/linting/orchestration/runtime/test-targets/test_target_roots";
import { TestTargets } from "src/linting/orchestration/runtime/test-targets/test_targets";
import { MockTestPathChecker } from "tests/linting/orchestration/runtime/test-targets/mock_test_path_checker";
import type { AstPythonImport } from "src/types";

describe("Python test target resolution", () => {
	test("resolves bridge imports from the configured source root", () => {
		const root = "/project";
		const checker = new MockTestPathChecker();
		const organization = new TestFileOrganization(root, checker);
		const target_roots = new TestTargetRoots(root, organization, checker);
		const expected_root = ["python-bridge", "implementation", "rules", "call_analysis"];

		expect(
			target_roots.common_root(
				"tests/python-bridge/implementation/rules/call_analysis/test_execution.py",
				["implementation.rules.call_analysis.python_test_execution_region"],
				true,
				expected_root,
			),
		).toEqual(expected_root);
	});

	test("resolves application and project-root packages", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker("/project/src/payments"));
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const application = targets.valid("tests/payments/test_reader.py", "from payments.reader import Reader\n", true, [
			{ line: 1, kind: "from", module: "payments.reader", names: [{ name: "Reader", alias: "" }] },
		]);
		const project_root = targets.valid(
			"tests/performance/test_report.py",
			"from performance.performance_report import PerformanceReport\n",
			true,
			[
				{
					line: 1,
					kind: "from",
					module: "performance.performance_report",
					names: [{ name: "PerformanceReport", alias: "" }],
				},
			],
		);

		expect({ application, project_root }).toEqual({ application: true, project_root: true });
	});

	test("resolves Python bridge imports from the test's source root", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const imports: AstPythonImport[] = [
			{
				line: 1,
				kind: "from",
				module: "python_bridge_entrypoint",
				names: [{ name: "PythonBridgeEntrypoint", alias: "" }],
			},
			{
				line: 2,
				kind: "from",
				module: "implementation.ast.python_ast_node_index",
				names: [{ name: "PythonAstNodeIndex", alias: "" }],
			},
		];

		expect({
			python_bridge: targets.valid(
				"tests/python-bridge/test-targets.test.py",
				"from python_bridge_entrypoint import PythonBridgeEntrypoint\nfrom implementation.ast.python_ast_node_index import PythonAstNodeIndex",
				true,
				imports,
			),
		}).toEqual({ python_bridge: true });
	});

	test("does not anchor to imported test-support modules", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const imports: AstPythonImport[] = [
			{
				line: 1,
				kind: "from",
				module: "tests.performance.support",
				names: [{ name: "SnapshotFixture", alias: "" }],
			},
			{
				line: 2,
				kind: "from",
				module: "performance.performance_report",
				names: [{ name: "PerformanceReport", alias: "" }],
			},
		];
		const source = [
			"from tests.performance.support import SnapshotFixture",
			"from performance.performance_report import PerformanceReport",
			"SnapshotFixture()",
			"SnapshotFixture()",
			"SnapshotFixture()",
			"PerformanceReport()",
		].join("\n");

		expect(targets.valid("tests/performance/test_report.py", source, true, imports)).toBe(true);
	});

	test("continues to a matching declaration when the most-used import has another test root", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const imports: AstPythonImport[] = [
			{
				line: 1,
				kind: "from",
				module: "payments.reader.domain",
				names: [
					{ name: "PaymentReader", alias: "" },
					{ name: "PaymentWriter", alias: "" },
				],
			},
			{ line: 2, kind: "from", module: "payments.service", names: [{ name: "PaymentService", alias: "" }] },
		];
		const source = [
			"from payments.reader.domain import PaymentReader, PaymentWriter",
			"from payments.service import PaymentService",
			"PaymentReader()",
			"PaymentReader()",
			"PaymentReader()",
			"PaymentWriter()",
			"PaymentWriter()",
			"PaymentWriter()",
			"PaymentService()",
			"PaymentService()",
			"PaymentService()",
			"PaymentService()",
			"PaymentService()",
		].join("\n");

		expect({
			less_used: targets.valid("tests/payments/reader/test_reader.py", source, true, imports),
			most_used: targets.valid("tests/payments/test_service.py", source, true, imports),
		}).toEqual({ less_used: true, most_used: true });
	});

	test("uses normalized Python imports instead of matching source strings", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker("/project/src/payments"));
		const targets = new TestTargets("/project", organization, new MockTestPathChecker());
		const imports: AstPythonImport[] = [
			{ line: 1, kind: "from", module: "os", names: [{ name: "Path", alias: "" }] },
			{ line: 1, kind: "from", module: "payments.reader", names: [{ name: "Reader", alias: "" }] },
		];

		expect(
			targets.valid(
				"tests/payments/test_reader.py",
				'text = "import payments.not_a_real_module"\nimport os, payments.reader\n',
				true,
				imports,
			),
		).toBe(true);
	});
});
