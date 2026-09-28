import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { describe, expect, test } from '@jest/globals';
import {
	TestFileOrganization,
} from 'src/bridge/ts/runner/orchestration/runtime/test-targets/test-file-organization';
import { TestTargets } from 'src/bridge/ts/runner/orchestration/runtime/test-targets/test-targets';
import type { TestPathChecker } from 'src/bridge/ts/core/context/protocols';

/** Responsibilities: _test path protocol_. **/
class MockTestPathChecker implements TestPathChecker {
	private readonly directories: ReadonlySet<string>;

	/** Responsibilities: _directory fixture setup_. **/
	public constructor(...directories: string[]) {
		this.directories = new Set(directories);
	}

	/** Responsibilities: _directory fixture lookup_. **/
	public directory(path: string): boolean {
		return this.directories.has(path);
	}
}

describe('test file organization', () => {
	test('accepts both module and scope layouts', () => {
		const root = '/project';
		const path_checker = new MockTestPathChecker('/project/src/payments', '/project/tools');
		const organization = new TestFileOrganization(root, path_checker);
		const result = {
			module: organization.valid('tests/payments/api/payment.test.ts'),
			leading_scope: organization.valid('tests/unit/payments/api/payment.test.ts'),
			leading_subscope: organization.valid('tests/performance/load/payments/api/payment.test.ts'),
			trailing_scope: organization.valid('tests/payments/api/integration/payment.test.ts'),
			trailing_subscope: organization.valid('tests/payments/api/acceptance/uat/payment.test.ts'),
			jest_directory: organization.valid('__tests__/payments/api/payment.spec.ts'),
			jest_plain_name: organization.valid('__tests__/payments/api/payment.ts'),
			root_module: organization.valid('tests/tools/cli.test.ts'),
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

	test('rejects missing modules, wrong roots, and unsupported names', () => {
		const root = '/project';
		const path_checker = new MockTestPathChecker('/project/src/payments');
		const organization = new TestFileOrganization(root, path_checker);
		const result = {
			missing_module: organization.valid('tests/orders/order.test.ts'),
			missing_path: organization.valid('tests/order.test.ts'),
			wrong_root: organization.valid('src/tests/payments/payment.test.ts'),
			unsupported_name: organization.valid('tests/payments/payment.ts'),
		};
		expect(result).toEqual({
			missing_module: false,
			missing_path: false,
			wrong_root: false,
			unsupported_name: false,
		});
	});

	test('collects targets from imports without resolving target files', () => {
		const organization = new TestFileOrganization('/project', new MockTestPathChecker());
		const targets = new TestTargets(organization);

		expect(
			targets.valid(
				'tests/bridge/ts/core/missing-target.test.ts',
				"import 'src/bridge/ts/core/module-that-does-not-exist';",
			),
		).toBe(true);
	});

	test('requires a non-test import and a matching common root', () => {
		const organization = new TestFileOrganization('/project', new MockTestPathChecker());
		const targets = new TestTargets(organization);
		const result = {
			test_import_only: targets.valid(
				'tests/bridge/ts/core/test-targets.test.ts',
				"import 'tests/bridge/ts/core/fixture';",
			),
			wrong_root: targets.valid(
				'tests/bridge/ts/core/test-targets.test.ts',
				"import 'src/metrics/fixture';",
			),
			python: targets.valid(
				'tests/parser/python-bridge/test-targets.test.py',
				'from entrypoint import PythonBridgeEntrypoint\\nfrom implementation.ast.node_index import PythonAstNodeIndex',
				true,
			),
		};

		expect(result).toEqual({ test_import_only: false, wrong_root: false, python: true });
	});
});
