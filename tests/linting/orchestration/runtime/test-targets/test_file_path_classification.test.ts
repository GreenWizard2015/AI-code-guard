import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { MockTestPathChecker } from "tests/linting/orchestration/runtime/test-targets/mock_test_path_checker";

describe("test file path classification", () => {
	test("accepts module and scope layouts", () => {
		const root = "/project";
		const path_checker = new MockTestPathChecker("/project/src/payments", "/project/tools");
		const organization = new TestFileOrganization(root, path_checker);
		const result = {
			module: organization.valid("tests/payments/api/payment.test.ts"),
			leading_scope: organization.valid("tests/unit/payments/api/payment.test.ts"),
			leading_subscope: organization.valid("tests/performance/load/payments/api/payment.test.ts"),
			trailing_scope: organization.valid("tests/payments/api/integration/payment.test.ts"),
			trailing_subscope: organization.valid("tests/payments/api/acceptance/uat/payment.test.ts"),
			jest_directory: organization.valid("__tests__/payments/api/payment.spec.ts"),
			jest_plain_name: organization.valid("__tests__/payments/api/payment.ts"),
			root_module: organization.valid("tests/tools/cli.test.ts"),
		};

		expect(result).toEqual({
			module: true,
			leading_scope: true,
			leading_subscope: true,
			trailing_scope: true,
			trailing_subscope: true,
			jest_directory: true,
			jest_plain_name: true,
			root_module: true,
		});
	});

	test("treats architecture as a test grouping rather than a source module", () => {
		const organization = new TestFileOrganization("/project", new MockTestPathChecker());

		expect(organization.module_paths("tests/bridge/ts/core/architecture/metrics.test.ts")).toEqual([
			["core"],
			["bridge", "ts", "core", "architecture"],
		]);
	});

	test("rejects missing modules, wrong roots, and unsupported names", () => {
		const root = "/project";
		const path_checker = new MockTestPathChecker("/project/src/payments");
		const organization = new TestFileOrganization(root, path_checker);
		const result = {
			missing_module: organization.valid("tests/orders/order.test.ts"),
			missing_path: organization.valid("tests/order.test.ts"),
			wrong_root: organization.valid("src/tests/payments/payment.test.ts"),
			unsupported_name: organization.valid("tests/payments/payment.ts"),
		};

		expect(result).toEqual({
			missing_module: false,
			missing_path: false,
			wrong_root: false,
			unsupported_name: false,
		});
	});
});
