import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { DYNAMIC_IMPORT_FILES } from "tests/core/constants/alias_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("import and runtime policy analysis", () => {
	test("detects Object.prototype.toString through a local alias", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"object-string-alias.ts": [
					"export class ObjectTagReader {",
					"\tpublic read(value: object): string {",
					"\t\tconst object_string = Object.prototype.toString;",
					"\t\treturn object_string.call(value);",
					"\t}",
					"\tpublic read_through_prototype_alias(value: object): string {",
					"\t\tconst object_prototype = Object.prototype;",
					"\t\tconst object_string = object_prototype.toString;",
					"\t\treturn object_string.call(value);",
					"\t}",
					"\tpublic read_through_destructuring(value: object): string {",
					"\t\tconst { toString: object_string } = Object.prototype;",
					"\t\treturn object_string.call(value);",
					"\t}",
					"\tpublic read_from_object(value: object): string {",
					"\t\tconst object_methods = { stringify: Object.prototype.toString };",
					"\t\treturn object_methods.stringify.call(value);",
					"\t}",
					"\tpublic read_from_array(value: object): string {",
					"\t\tconst object_methods = [Object.prototype.toString];",
					"\t\treturn object_methods[0].call(value);",
					"\t}",
					"\tpublic read_from_computed_members(value: object): string {",
					'\t\tconst object_string = Object["prototype"]["toString"];',
					"\t\treturn object_string.call(value);",
					"\t}",
					"}",
					"",
				].join("\n"),
				"custom-object-string.ts": [
					"export class CustomTag {",
					"\tpublic toString(): string {",
					'\t\treturn "custom";',
					"\t}",
					"\tpublic label(): string {",
					"\t\tconst custom_string = this.toString;",
					"\t\treturn custom_string.call(this);",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter(
				(violation) =>
					violation.file === "object-string-alias.ts" && violation.rule_id === "typescript-object-prototype-string",
			),
		).toHaveLength(6);
		expect(
			violations.filter(
				(violation) =>
					violation.file === "custom-object-string.ts" && violation.rule_id === "typescript-object-prototype-string",
			),
		).toHaveLength(0);
	});

	test("detects dynamic, nested, late, and relative imports", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				...DYNAMIC_IMPORT_FILES,
				"require-alias.ts": ["const load = require;", "load(module_name);"].join("\n"),
				"late.ts": ["export const value = 1;", "import { helper } from './helper';"].join("\n"),
				"late.py": ["value = 1", "from module import helper"].join("\n"),
				"relative.ts": ["import { value } from './value';", "import type { Item } from '../item';"].join("\n"),
				"relative.py": ["from .value import value", "from ..item import Item"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			dynamic_imports: messages.filter((message) => message === "avoid dynamic imports").length,
			nested_imports: messages.filter((message) => message === "avoid nested imports").length,
			late_imports: messages.filter((message) => message === "imports must be at the beginning of the file").length,
			relative_imports: violations.filter((item) => item.rule_id === "relative-import").length,
		}).toEqual({ dynamic_imports: 15, nested_imports: 1, late_imports: 2, relative_imports: 6 });
	});

	test("detects Python path mutation, object runtime hacks, and reflective APIs", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
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
					"    stored_append = sys.path.append",
					'    stored_append("stored")',
				].join("\n"),
				"path-containers.py": [
					"import sys",
					"MUTATORS = {'add': sys.path.append}",
					"MUTATORS['add']('one')",
					"MUTATORS_LIST = [sys.path.append]",
					"MUTATORS_LIST[0]('two')",
				].join("\n"),
				"path-map.py": [
					"import sys",
					'paths = {"project": sys.path}',
					'project_path = paths["project"]',
					'project_path.append("runtime")',
				].join("\n"),
				"path-descriptor.py": ["import sys", "list.extend(sys.path, ['project'])"].join("\n"),
				"object-hacks.ts": [
					"const target = {};",
					"Object.assign(target, { value: 1 });",
					"const apis = [{ Object }];",
					"apis[0].Object.assign({}, {});",
					'Object.prototype.hasOwnProperty.call(target, "value");',
				].join("\n"),
				"stored-members.ts": [
					"function scale(value: number): number { return value * 2; }",
					"const CONTROL_BIND = scale.bind(null);",
					"const OPERATIONS = { bind: scale.bind, merge: Object.assign };",
					"OPERATIONS.bind.call(scale, null);",
					"OPERATIONS.merge({}, { value: 1 });",
				].join("\n"),
				"wrapped-object-hacks.ts": [
					'Object["prototype"][("hasOwnProperty")]["call"](target, "value");',
					'Object["prototype"]["hasOwnProperty" as "hasOwnProperty"]["call"](target, "value");',
				].join("\n"),
				"wrapped-operations.ts": [
					"const payload = { value: 1 };",
					"(Object.assign)(payload, { value: 2 });",
					"(Object.prototype.toString).call(payload);",
					"String.raw`${(Math.random() > 0.5) && console.log(payload)}`;",
				].join("\n"),
				"array-operations.ts": [
					"function scale(value: number): number { return value * 2; }",
					"const OPERATIONS = [Object.assign, scale.bind];",
					"OPERATIONS[0]({}, { value: 1 });",
					"OPERATIONS[1].call(scale, null);",
					"const ENABLED = true;",
					"new Set([ENABLED && process.cwd()]);",
				].join("\n"),
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
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			path_mutations: messages.filter((message) => message === "avoid sys.path mutations").length,
			object_assign: messages.includes("avoid Object.assign"),
			bind_calls: messages.includes("avoid .bind calls"),
			object_call: messages.includes("avoid Object method .call"),
			reflective_runtime: messages.filter((message) => message === "avoid reflective and dynamic runtime APIs").length,
		}).toEqual({
			path_mutations: 16,
			object_assign: true,
			bind_calls: true,
			object_call: true,
			reflective_runtime: 12,
		});
	});
});
