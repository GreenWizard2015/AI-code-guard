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
			module: organization.for_file("tests/payments/api/payment.test.ts").valid(),
			leading_scope: organization.for_file("tests/unit/payments/api/payment.test.ts").valid(),
			leading_subscope: organization.for_file("tests/performance/load/payments/api/payment.test.ts").valid(),
			trailing_scope: organization.for_file("tests/payments/api/integration/payment.test.ts").valid(),
			trailing_subscope: organization.for_file("tests/payments/api/acceptance/uat/payment.test.ts").valid(),
			jest_directory: organization.for_file("__tests__/payments/api/payment.spec.ts").valid(),
			jest_plain_name: organization.for_file("__tests__/payments/api/payment.ts").valid(),
			root_module: organization.for_file("tests/tools/cli.test.ts").valid(),
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

		expect(organization.for_file("tests/bridge/ts/core/architecture/metrics.test.ts").module_paths()).toEqual([
			["core"],
			["bridge", "ts", "core", "architecture"],
		]);
	});

	test("rejects missing modules, wrong roots, and unsupported names", () => {
		const root = "/project";
		const path_checker = new MockTestPathChecker("/project/src/payments");
		const organization = new TestFileOrganization(root, path_checker);
		const result = {
			missing_module: organization.for_file("tests/orders/order.test.ts").valid(),
			missing_path: organization.for_file("tests/order.test.ts").valid(),
			wrong_root: organization.for_file("src/tests/payments/payment.test.ts").valid(),
			unsupported_name: organization.for_file("tests/payments/payment.ts").valid(),
		};

		expect(result).toEqual({
			missing_module: false,
			missing_path: false,
			wrong_root: false,
			unsupported_name: false,
		});
	});
});
