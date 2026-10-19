import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("dynamic runtime alias analysis", () => {
	test("detects runtime APIs through saved and spread object aliases", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"spread.ts": [
						"const reflect_source = { Reflect };",
						"const { Reflect: spread_reflect_alias } = { ...reflect_source };",
						'spread_reflect_alias.get(target, "spread");',
					].join("\n"),
					"chain.ts": [
						"const reflect_source = { Reflect };",
						"const chained_source = { ...reflect_source };",
						"const { Reflect: chained_reflect_alias } = { ...chained_source };",
						'chained_reflect_alias.get(target, "chained");',
					].join("\n"),
					"proxy.ts": [
						"const proxy_source = { Proxy };",
						"const { Proxy: spread_proxy_alias } = { ...proxy_source };",
						"new spread_proxy_alias(target, handler);",
					].join("\n"),
					"assigned.ts": [
						"let reflect_source;",
						"reflect_source = { Reflect };",
						"const { Reflect: assigned_reflect_alias } = { ...reflect_source };",
						'assigned_reflect_alias.get(target, "assigned");',
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "typescript-dynamic-runtime-usage").length;
		expect(count).toBe(4);
	});

	test("detects dynamic runtime APIs through members, arrays, objects, and typed keys", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"members.ts": [
						"const reflect_holder = { Reflect };",
						'reflect_holder.Reflect.get(target, "member");',
						'reflect_holder["Reflect"].get(target, "element");',
					].join("\n"),
					"properties.ts": [
						"const runtime = { reflect: Reflect, proxy: Proxy };",
						'runtime.reflect.get(target, "value");',
						"new runtime.proxy(target, handler);",
						"const object_api = { own: Object.hasOwn };",
						'object_api.own({}, "value");',
					].join("\n"),
					"array.ts": "const runtimes = [Reflect];\nruntimes[0].get({}, 'value');",
					"object-values.ts": [
						"const runtime = { Reflect, Proxy };",
						'const methods = [runtime["Reflect"], runtime["Proxy"]];',
						'methods[0].get(target, "value");',
						"new methods[1](target, handler);",
					].join("\n"),
					"typed-key.ts": [
						"type RuntimeKey = 'get' | 'set';",
						"declare const key: RuntimeKey;",
						"Reflect[key](target, 'value');",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "typescript-dynamic-runtime-usage").length;
		expect(count).toBe(8);
	});
});
