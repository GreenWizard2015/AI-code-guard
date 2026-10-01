import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { DYNAMIC_IMPORT_FILES } from "tests/core/constants";

describe("coding-lint syntax and policy rules", () => {
	test("rejects dynamic and nested imports", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(DYNAMIC_IMPORT_FILES);
		const messages = violations.map((violation) => violation.message);

		expect(messages.filter((message) => message === "avoid dynamic imports")).toHaveLength(14);
		expect(messages.filter((message) => message === "avoid nested imports")).toHaveLength(1);
	});

	test("rejects dynamic imports through a local require alias", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"require-alias.ts": ["const load = require;", "load(module_name);"].join("\n"),
		});
		expect(messages.filter((message) => message === "avoid dynamic imports")).toHaveLength(1);
	});

	test("rejects imports after module code", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"late.ts": ["export const value = 1;", "import { helper } from './helper';"].join("\n"),
			"late.py": ["value = 1", "from module import helper"].join("\n"),
		});

		expect(messages.filter((message) => message === "imports must be at the beginning of the file")).toHaveLength(2);
	});

	test("rejects relative imports in TypeScript and Python", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"relative.ts": ["import { value } from './value';", "import type { Item } from '../item';"].join("\n"),
			"relative.py": ["from .value import value", "from ..item import Item"].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "relative-import")).toHaveLength(4);
	});

	test("rejects all direct sys.path mutations but allows reads", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"path.py": [
				"import sys as system",
				'system.path.append("alias")',
				"from sys import path as sys_path",
				'sys_path.append("imported")',
				"path_alias = system.path",
				'path_alias.append("assigned")',
				"destructured_path, ignored = (sys.path, None)",
				'destructured_path.append("destructured")',
				"import sys",
				'sys.path.insert(0, "proxy")',
				"def configure():",
				'    sys.path.append("support")',
				'    sys.path[0] = "support"',
				'    sys.path += ["late"]',
				'    sys.path = ["replacement"]',
				"    del sys.path[:1]",
				"    size = len(sys.path)",
				'    getattr(sys, "path").append("reflected")',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid sys.path mutations")).toHaveLength(11);
	});

	test("rejects sys.path mutations through mapping subscripts", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"path-map.py": [
				"import sys",
				'paths = {"project": sys.path}',
				'project_path = paths["project"]',
				'project_path.append("runtime")',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid sys.path mutations")).toHaveLength(1);
	});

	test("rejects Object state merging and Object method calls", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"object-hacks.ts": [
				"const target = {};",
				"Object.assign(target, { value: 1 });",
				"const apis = [{ Object }];",
				"apis[0].Object.assign({}, {});",
				'Object.prototype.hasOwnProperty.call(target, "value");',
			].join("\n"),
		});

		expect(messages).toContain("avoid Object.assign");
		expect(messages).toContain("avoid Object method .call");
	});

	test("rejects wrapped Object method keys", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"wrapped-object-hacks.ts": [
				'Object["prototype"][("hasOwnProperty")]["call"](target, "value");',
				'Object["prototype"]["hasOwnProperty" as "hasOwnProperty"]["call"](target, "value");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid Object method .call")).toHaveLength(2);
	});

	test("rejects reflective and dynamic runtime APIs", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"dynamic-runtime.ts": [
				"declare const target: Record<string, unknown>;",
				"declare const name_string: string;",
				'Reflect.get(target, "value");',
				'Reflect["apply"](target, thisArg, args);',
				"const setter = Reflect.set;",
				"new Proxy(target, handler);",
				"const reflect_alias = Reflect;",
				'reflect_alias.get(target, "alias");',
				"const proxy_alias = Proxy;",
				"new proxy_alias(target, handler);",
				"const { get: reflect_get } = Reflect;",
				'reflect_get(target, "destructured");',
				"target[name_string];",
				"items[0];",
				"eval(source);",
				"new Function(source);",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(8);
	});
});
