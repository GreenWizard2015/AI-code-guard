import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("dynamic runtime alias policy", () => {
	test("rejects Reflect aliases spread from saved objects", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-alias.ts": [
				"const reflect_source = { Reflect };",
				"const { Reflect: spread_reflect_alias } = { ...reflect_source };",
				'spread_reflect_alias.get(target, "spread");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects Reflect aliases through chained object spreads", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-chain.ts": [
				"const reflect_source = { Reflect };",
				"const chained_source = { ...reflect_source };",
				"const { Reflect: chained_reflect_alias } = { ...chained_source };",
				'chained_reflect_alias.get(target, "chained");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects Proxy aliases spread from saved objects", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-proxy-alias.ts": [
				"const proxy_source = { Proxy };",
				"const { Proxy: spread_proxy_alias } = { ...proxy_source };",
				"new spread_proxy_alias(target, handler);",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects Reflect aliases assigned into saved objects", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-assigned-alias.ts": [
				"let reflect_source;",
				"reflect_source = { Reflect };",
				"const { Reflect: assigned_reflect_alias } = { ...reflect_source };",
				'assigned_reflect_alias.get(target, "assigned");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects Reflect calls through object member aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-object-member.ts": [
				"const reflect_holder = { Reflect };",
				'reflect_holder.Reflect.get(target, "member");',
				'reflect_holder["Reflect"].get(target, "element");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(2);
	});

	test("rejects runtime APIs through object properties", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-property.ts": [
				"const runtime = { reflect: Reflect, proxy: Proxy };",
				'runtime.reflect.get(target, "value");',
				"new runtime.proxy(target, handler);",
				"const object_api = { own: Object.hasOwn };",
				'object_api.own({}, "value");',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(3);
	});

	test("rejects Reflect aliases through indexed arrays", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-array.ts": ["const runtimes = [Reflect];", "runtimes[0].get({}, 'value');"].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects Reflect aliases through indexed object values", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-array-object.ts": [
				"const runtimes = [{ Reflect }];",
				"runtimes[0].Reflect.get({}, 'value');",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});

	test("rejects dynamic access through typed string aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"dynamic-runtime-string-alias.ts": [
				"declare const target: object;",
				"declare const typed_key: string;",
				"const key_alias = typed_key;",
				"target[key_alias];",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid reflective and dynamic runtime APIs")).toHaveLength(1);
	});
});
